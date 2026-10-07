// Behaviour tests for the admin console's same-origin proxy (H09). They drive
// the real `app/lib/admin-proxy.ts` against a local stub of the backend's
// /admin API; they say nothing about the production backend itself.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { registerHooks } from "node:module";
import test, { afterEach } from "node:test";

const root = new URL("../", import.meta.url);
// The proxy imports "@/app/lib/loop" — the bundler's alias for the repo root.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(new URL(`${specifier.slice(2)}.ts`, root).href, context);
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error?.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".")) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const { proxyAdmin } = await import(new URL("../app/lib/admin-proxy.ts", import.meta.url).href);

let server = null;
const seen = [];

async function stub(handler) {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, body });
      handler(req, res, body);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.LOOP_ADMIN_API_BASE = `http://127.0.0.1:${server.address().port}/api`;
}

afterEach(async () => {
  process.env.FLOW_ADMIN_ENABLED = "";
  process.env.LOOP_ADMIN_API_BASE = "";
  seen.length = 0;
  if (server) await new Promise((resolve) => server.close(resolve));
  server = null;
});

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

function request(method, path, { cookie, origin = "http://localhost:3000", body } = {}) {
  return new Request(`http://localhost:3000/api/admin/${path}`, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}), "content-type": "application/json" },
    body,
  });
}

test("the admin surface doesn't exist unless explicitly enabled", async () => {
  const res = await proxyAdmin(request("GET", "session"), ["session"]);
  assert.equal(res.status, 404);
});

test("login puts the token in a strict HttpOnly cookie and nowhere in the body", async () => {
  process.env.FLOW_ADMIN_ENABLED = "true";
  await stub((_req, res) => send(res, 200, { access_token: "secret-admin-token", expires_in: 900, admin: { name: "管理员" } }));

  const res = await proxyAdmin(request("POST", "session", { body: JSON.stringify({ password: "pw" }) }), ["session"]);
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie");
  assert.match(cookie, /^flow_admin=secret-admin-token;/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  const body = await res.text();
  assert.doesNotMatch(body, /secret-admin-token/);
  assert.deepEqual(JSON.parse(body), { admin: { name: "管理员" }, expiresIn: 900 });
});

test("calls carry the admin cookie as a bearer token; a member session alone gets nothing", async () => {
  process.env.FLOW_ADMIN_ENABLED = "true";
  await stub((_req, res) => send(res, 200, { circles: [], next_cursor: null }));

  const member = await proxyAdmin(request("GET", "circles", { cookie: "loop_at=member-token" }), ["circles"]);
  assert.equal(member.status, 401);
  assert.equal(seen.length, 0);

  const admin = await proxyAdmin(request("GET", "circles", { cookie: "flow_admin=adm" }), ["circles"]);
  assert.equal(admin.status, 200);
  assert.equal(seen[0].auth, "Bearer adm");
});

test("writes from another origin are refused before reaching the backend", async () => {
  process.env.FLOW_ADMIN_ENABLED = "true";
  await stub((_req, res) => send(res, 200, {}));

  const res = await proxyAdmin(
    request("POST", "circles/x/opening-balance-imports/preview", { cookie: "flow_admin=adm", origin: "https://evil.example" }),
    ["circles", "x", "opening-balance-imports", "preview"],
  );
  assert.equal(res.status, 403);
  assert.equal(seen.length, 0);
});

test("a missing backend route says so instead of looking like empty data", async () => {
  process.env.FLOW_ADMIN_ENABLED = "true";
  await stub((_req, res) => send(res, 405, {}));

  const res = await proxyAdmin(request("GET", "circles", { cookie: "flow_admin=adm" }), ["circles"]);
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, "后端接口未接通");
});

test("a lost confirm is reported as an unknown outcome, never replayed", async () => {
  process.env.FLOW_ADMIN_ENABLED = "true";
  await stub((req) => req.socket.destroy());

  const res = await proxyAdmin(
    request("POST", "circles/c/opening-balance-imports/p/confirm", { cookie: "flow_admin=adm", body: "{}" }),
    ["circles", "c", "opening-balance-imports", "p", "confirm"],
  );
  assert.equal(res.status, 504);
  assert.match((await res.json()).error, /结果未知/);
  assert.equal(seen.length, 1);
});

test("an expired admin session clears the cookie", async () => {
  process.env.FLOW_ADMIN_ENABLED = "true";
  await stub((_req, res) => send(res, 401, { error: { code: "admin_unauthenticated", message: "管理员登录已失效" } }));

  const res = await proxyAdmin(request("GET", "session", { cookie: "flow_admin=old" }), ["session"]);
  assert.equal(res.status, 401);
  assert.match(res.headers.get("set-cookie"), /flow_admin=; .*Max-Age=0/);
});
