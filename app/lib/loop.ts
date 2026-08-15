// Server-side client for loop-backend. CC's own `/api/*` route handlers use
// this to proxy loop-backend and adapt shapes, so the browser keeps talking to
// same-origin `/api/*` (no CORS) while loop-backend is the real backend.
//
// Auth uses loop's OTP + Bearer tokens, kept in httpOnly cookies:
//   loop_rt      – the 30-day refresh token (rotated on every refresh)
//   loop_at      – the 15-min access token
//   loop_at_exp  – access-token expiry (epoch seconds)
// Access tokens are used directly until near expiry, then a single refresh
// mints a new pair. Cookies are set on the outgoing response.

// `process` is not defined in the Cloudflare Worker runtime — guard the access
// (and use bracket lookup so Next's build doesn't statically inline it) so the
// module can't crash at load time. Defaults to production.
export const LOOP_API_BASE = ((): string => {
  try {
    if (typeof process !== "undefined" && process.env) {
      const v = (process.env as Record<string, string | undefined>)["LOOP_API_BASE"];
      if (v) return v.replace(/\/$/, "");
    }
  } catch {
    /* ignore */
  }
  return "https://loop-api.sola.day/api";
})();

const RT = "loop_rt";
const AT = "loop_at";
const AT_EXP = "loop_at_exp";
const SKEW = 60; // refresh this many seconds before the access token expires

export type Cookie = { name: string; value: string; maxAge: number };

// ─── cookie plumbing ────────────────────────────────────────────────────────

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function serialize({ name, value, maxAge }: Cookie): string {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  return attrs.join("; ");
}

export function attachCookies(response: Response, cookies: Cookie[]): Response {
  for (const c of cookies) response.headers.append("set-cookie", serialize(c));
  return response;
}

export function sessionCookies(refreshToken: string, accessToken: string, expiresIn: number): Cookie[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    { name: RT, value: refreshToken, maxAge: 60 * 60 * 24 * 30 },
    { name: AT, value: accessToken, maxAge: expiresIn },
    { name: AT_EXP, value: String(now + expiresIn), maxAge: expiresIn },
  ];
}

export function clearedCookies(): Cookie[] {
  return [RT, AT, AT_EXP].map((name) => ({ name, value: "", maxAge: 0 }));
}

// ─── token resolution ───────────────────────────────────────────────────────

type Resolved = { accessToken: string | null; cookies: Cookie[] };

// loop rotates the refresh token on every use, so two requests that arrive
// together with an expired access token would both spend the *same* RT: the
// first succeeds, the second is handed an already-consumed token, gets a 401,
// and clears the session — logging the user out mid-action. The page fires
// concurrent requests routinely (the ?join= effect alongside a user action),
// so collapse overlapping refreshes of one RT onto a single in-flight call.
const inFlight = new Map<string, Promise<Resolved>>();

async function refresh(rt: string): Promise<Resolved> {
  const res = await fetch(`${LOOP_API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: rt }),
  });

  if (!res.ok) return { accessToken: null, cookies: clearedCookies() };

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    cookies: sessionCookies(data.refresh_token, data.access_token, data.expires_in),
  };
}

// Return a usable access token for this request, refreshing (and producing
// Set-Cookie updates) only when the cached one is missing or near expiry.
export async function ensureAccessToken(request: Request): Promise<Resolved> {
  const at = readCookie(request, AT);
  const exp = Number(readCookie(request, AT_EXP) || 0);
  const now = Math.floor(Date.now() / 1000);

  if (at && exp > now + SKEW) return { accessToken: at, cookies: [] };

  const rt = readCookie(request, RT);
  if (!rt) return { accessToken: null, cookies: [] };

  // Both callers get the same new pair, so whichever Set-Cookie lands last
  // still leaves the browser holding a consistent, live session.
  let pending = inFlight.get(rt);
  if (!pending) {
    pending = refresh(rt).finally(() => inFlight.delete(rt));
    inFlight.set(rt, pending);
  }
  return pending;
}

// ─── authenticated loop calls ───────────────────────────────────────────────

export type LoopCall = (
  path: string,
  init?: RequestInit,
) => Promise<Response>;

// Run `handler` with a valid access token and a bound loop-fetch, attaching any
// refreshed-session cookies to whatever Response it returns. `handler` receives
// `null` when the caller is unauthenticated so it can decide the response.
export async function withLoop(
  request: Request,
  handler: (token: string | null, call: LoopCall) => Promise<Response>,
): Promise<Response> {
  const { accessToken, cookies } = await ensureAccessToken(request);

  const call: LoopCall = (path, init = {}) =>
    fetch(`${LOOP_API_BASE}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...(init.headers || {}),
      },
    });

  const response = await handler(accessToken, call);
  return attachCookies(response, cookies);
}

// Read the refresh token straight from cookies (for logout).
export function refreshToken(request: Request): string | null {
  return readCookie(request, RT);
}
