// Behaviour tests for session renewal and fault handling (F1).
//
// These drive the real `app/lib/loop.ts` against a local stub of
// loop-backend, so they prove what the frontend actually does with each kind
// of upstream answer. They are frontend fault-handling tests: a pass here says
// nothing about whether the production backend behaves this way.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import test, { afterEach } from "node:test";

const loopUrl = new URL("../app/lib/loop.ts", import.meta.url).href;

let server = null;
let base = "";

afterEach(async () => {
  process.env.LOOP_API_BASE = "";
  process.env.LOOP_UPSTREAM_TIMEOUT_MS = "";
  if (server) await new Promise((resolve) => server.close(resolve));
  server = null;
});

// Stand up a stub loop-backend. `handler` sees every request so tests can
// assert on what the frontend actually sent upstream.
async function startStub(handler) {
  const seen = [];
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, body });
      handler(req, res, body);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  process.env.LOOP_API_BASE = base;
  return seen;
}

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

const NOW = Math.floor(Date.now() / 1000);

// A request whose access token has just expired but that still holds a refresh
// token — the case that used to log people out on any non-200.
function expiredRequest(rt = "rt-1") {
  return new Request("http://localhost/api/bootstrap", {
    headers: { cookie: `loop_rt=${rt}; loop_at=old-access; loop_at_exp=${NOW - 5}` },
  });
}

function liveRequest(at = "fresh-access") {
  return new Request("http://localhost/api/bootstrap", {
    headers: { cookie: `loop_rt=rt-live; loop_at=${at}; loop_at_exp=${NOW + 600}` },
  });
}

function cookies(response) {
  return response.headers.getSetCookie();
}

function cleared(response) {
  return cookies(response).filter((value) => /^loop_(rt|at|at_exp)=;\s/.test(value) || /Max-Age=0/.test(value));
}

test("a successful refresh mints a new session and forwards it", async () => {
  const seen = await startStub((req, res) => {
    json(res, 200, { access_token: "new-access", refresh_token: "new-rt", expires_in: 900 });
  });

  const { withLoop } = await import(loopUrl);
  const response = await withLoop(expiredRequest(), async (token) => Response.json({ token }));

  assert.equal(await response.json().then((d) => d.token), "new-access");
  assert.equal(seen.filter((r) => r.url.endsWith("/auth/refresh")).length, 1);
  const set = cookies(response);
  assert.ok(set.some((value) => value.startsWith("loop_at=new-access")));
  assert.ok(set.some((value) => value.startsWith("loop_rt=new-rt")));
  assert.equal(cleared(response).length, 0);
});

test("a live access token is reused without spending the refresh token", async () => {
  const seen = await startStub(() => { throw new Error("must not refresh"); });

  const { withLoop } = await import(loopUrl);
  const response = await withLoop(liveRequest(), async (token) => Response.json({ token }));

  assert.equal(await response.json().then((d) => d.token), "fresh-access");
  assert.equal(seen.length, 0);
  assert.equal(cookies(response).length, 0);
});

test("a refresh the backend confirms as dead clears the session", async () => {
  await startStub((req, res) => {
    json(res, 401, { error: { code: "invalid_token", message: "登录已失效，请重新登录" } });
  });

  const { withLoop } = await import(loopUrl);
  const response = await withLoop(expiredRequest(), async (token) => Response.json({ token }));

  assert.equal(await response.json().then((d) => d.token), null);
  assert.equal(cleared(response).length, 3);
});

test("rate limiting during refresh keeps the session and asks for a retry", async () => {
  await startStub((req, res) => {
    res.writeHead(429, { "content-type": "application/json", "retry-after": "30" });
    res.end(JSON.stringify({ error: { code: "too_many_requests" } }));
  });

  const { withLoop } = await import(loopUrl);
  let reachedHandler = false;
  const response = await withLoop(expiredRequest(), async () => { reachedHandler = true; return Response.json({ ok: true }); });

  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "session_unavailable");
  assert.equal(reachedHandler, false);
  assert.equal(cookies(response).length, 0);
});

test("a 5xx during refresh keeps the session and asks for a retry", async () => {
  await startStub((req, res) => { res.writeHead(503); res.end("upstream down"); });

  const { withLoop } = await import(loopUrl);
  const response = await withLoop(expiredRequest(), async () => Response.json({ ok: true }));

  assert.equal(response.status, 503);
  assert.equal(cleared(response).length, 0);
  assert.equal(cookies(response).length, 0);
});

test("an auth failure with an unrecognised code is not treated as a logout", async () => {
  await startStub((req, res) => json(res, 401, { error: { code: "mfa_required" } }));

  const { withLoop } = await import(loopUrl);
  const response = await withLoop(expiredRequest(), async () => Response.json({ ok: true }));

  assert.equal(response.status, 503);
  assert.equal(cleared(response).length, 0);
});

test("a malformed refresh response keeps the session", async () => {
  await startStub((req, res) => json(res, 200, { surprise: true }));

  const { withLoop } = await import(loopUrl);
  const response = await withLoop(expiredRequest(), async () => Response.json({ ok: true }));

  assert.equal(response.status, 503);
  assert.equal(cleared(response).length, 0);
});

test("a refresh that never answers keeps the session", async () => {
  process.env.LOOP_UPSTREAM_TIMEOUT_MS = "150";
  // Deliberately never respond: the deadline is what has to save us.
  await startStub(() => {});

  const { withLoop } = await import(loopUrl);
  const response = await withLoop(expiredRequest(), async () => Response.json({ ok: true }));

  assert.equal(response.status, 503);
  assert.equal(cleared(response).length, 0);
  assert.equal(cookies(response).length, 0);
});

test("concurrent refreshes of one session share a single upstream call and never clear cookies", async () => {
  let refreshCalls = 0;
  await startStub((req, res) => {
    refreshCalls += 1;
    json(res, 200, { access_token: "shared-access", refresh_token: "shared-rt", expires_in: 900 });
  });

  const { withLoop } = await import(loopUrl);
  const responses = await Promise.all([
    withLoop(expiredRequest(), async (token) => Response.json({ token })),
    withLoop(expiredRequest(), async (token) => Response.json({ token })),
    withLoop(expiredRequest(), async (token) => Response.json({ token })),
  ]);

  assert.equal(refreshCalls, 1, "overlapping refreshes must collapse onto one call");
  for (const response of responses) {
    assert.equal(await response.json().then((d) => d.token), "shared-access");
    assert.equal(cleared(response).length, 0);
  }
});

test("a write lost to a timeout is reported as inconclusive and never replayed", async () => {
  process.env.LOOP_UPSTREAM_TIMEOUT_MS = "150";
  const seen = await startStub(() => {});

  const { withLoop } = await import(loopUrl);
  const response = await withLoop(liveRequest(), async (_token, call) => {
    const upstream = await call("/circles/c1/records", { method: "POST", body: JSON.stringify({ amount: 4 }) });
    return Response.json({ status: upstream.status, code: (await upstream.json()).code });
  });

  const body = await response.json();
  assert.equal(body.status, 504);
  assert.equal(body.code, "upstream_unreachable");
  assert.equal(seen.length, 1, "the frontend must not retry a write on its own");
});

test("no session cookies at all stays anonymous without clearing anything", async () => {
  await startStub(() => { throw new Error("must not call the backend"); });

  const { withLoop } = await import(loopUrl);
  const response = await withLoop(new Request("http://localhost/api/bootstrap"), async (token) => Response.json({ token }));

  assert.equal(await response.json().then((d) => d.token), null);
  assert.equal(cookies(response).length, 0);
});

test("session cookies stay HttpOnly, Secure and SameSite", async () => {
  await startStub((req, res) => json(res, 200, { access_token: "a", refresh_token: "r", expires_in: 900 }));

  const { withLoop } = await import(loopUrl);
  const response = await withLoop(expiredRequest(), async () => Response.json({ ok: true }));

  for (const value of cookies(response)) {
    assert.match(value, /HttpOnly/i);
    assert.match(value, /Secure/i);
    assert.match(value, /SameSite=Lax/i);
  }
});
