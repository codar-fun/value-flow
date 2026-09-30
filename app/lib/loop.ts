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

// `process` is not defined in the Cloudflare Worker runtime. Read request-time
// Worker env first, then fall back to process.env for the Node dev server.
export function runtimeEnv(name: string): string | undefined {
  try {
    if (typeof process !== "undefined" && process.env) return (process.env as Record<string, string | undefined>)[name];
  } catch {
    /* ignore */
  }
  const workerEnv = (globalThis as typeof globalThis & { __FLOW_CIRCLE_ENV?: Record<string, unknown> }).__FLOW_CIRCLE_ENV;
  const value = workerEnv?.[name];
  return typeof value === "string" ? value : undefined;
}

function resolveLoopApiBase(): string {
  return (runtimeEnv("LOOP_API_BASE") || "https://loop-api.sola.day/api").replace(/\/$/, "");
}

// Kept for callers and tests that need the configured value at module load;
// request paths use loopApiBase() so Worker env changes are respected.
export const LOOP_API_BASE = resolveLoopApiBase();
export function loopApiBase(): string {
  return resolveLoopApiBase();
}

const RT = "loop_rt";
const AT = "loop_at";
const AT_EXP = "loop_at_exp";
const SKEW = 60; // refresh this many seconds before the access token expires

// Every upstream call gets a deadline. Without one a hung loop-backend keeps
// the request open indefinitely and the page just spins.
const DEFAULT_UPSTREAM_TIMEOUT_MS = 10_000;

export function upstreamTimeoutMs(): number {
  const raw = Number(runtimeEnv("LOOP_UPSTREAM_TIMEOUT_MS"));
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_UPSTREAM_TIMEOUT_MS;
}

// `error.code` values the backend uses to say "this credential is dead". Only
// these (or a bare 401/403 with no code) may end the session. Anything else —
// rate limiting, a 5xx, a gateway blip, an unknown code — is temporary and
// must leave the person signed in.
const INVALID_CREDENTIAL_CODES = new Set([
  "invalid_token",
  "token_expired",
  "token_revoked",
  "invalid_grant",
  "refresh_token_expired",
  "refresh_token_invalid",
  "session_revoked",
  "authentication_required",
]);

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

// What the last token resolution concluded about the caller's session.
//   ok         – a usable access token is in hand
//   anonymous  – no session cookies at all; nothing was cleared
//   invalid    – the backend confirmed the credential is dead; cookies cleared
//   temporary  – we could not confirm anything (timeout, network, 429, 5xx,
//                malformed body); the session is left untouched
export type SessionOutcome = "ok" | "anonymous" | "invalid" | "temporary";

export type LoopSession = {
  accessToken: string | null;
  outcome: SessionOutcome;
  // Diagnostics only: never shown to the browser verbatim.
  reason?: string;
};

type Resolved = { session: LoopSession; cookies: Cookie[] };

// loop rotates the refresh token on every use, so two requests that arrive
// together with an expired access token would both spend the *same* RT: the
// first succeeds, the second is handed an already-consumed token, gets a 401,
// and clears the session — logging the user out mid-action. The page fires
// concurrent requests routinely (the ?join= effect alongside a user action),
// so collapse overlapping refreshes of one RT onto a single in-flight call.
const inFlight = new Map<string, Promise<Resolved>>();

function describeFetchFailure(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") return "timeout";
    return error.name || "fetch_failed";
  }
  return "fetch_failed";
}

// Best-effort read of `error.code` from a loop error response.
async function errorCode(res: Response): Promise<string | null> {
  const data = (await res.json().catch(() => null)) as
    | { error?: { code?: string } | string }
    | null;
  const error = data?.error;
  if (!error) return null;
  if (typeof error === "string") return error;
  return typeof error.code === "string" ? error.code : null;
}

async function refresh(rt: string): Promise<Resolved> {
  let res: Response;
  try {
    res = await fetch(`${loopApiBase()}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
      signal: AbortSignal.timeout(upstreamTimeoutMs()),
    });
  } catch (error) {
    // Network loss, DNS failure or our own deadline. Nothing here says the
    // credential is bad, so keep the session and let the caller retry.
    return {
      session: { accessToken: null, outcome: "temporary", reason: `refresh_${describeFetchFailure(error)}` },
      cookies: [],
    };
  }

  if (res.status === 401 || res.status === 403) {
    const code = await errorCode(res);
    // An auth failure we don't recognise is not proof the session is dead —
    // guessing here is what used to log people out during backend blips.
    if (code && !INVALID_CREDENTIAL_CODES.has(code)) {
      return {
        session: { accessToken: null, outcome: "temporary", reason: `refresh_unconfirmed_code_${code}` },
        cookies: [],
      };
    }
    return {
      session: { accessToken: null, outcome: "invalid", reason: code ? `refresh_${code}` : "refresh_unauthorized" },
      cookies: clearedCookies(),
    };
  }

  // 429 and 5xx are exactly the transient conditions that used to be treated
  // as a logout.
  if (!res.ok) {
    return { session: { accessToken: null, outcome: "temporary", reason: `refresh_status_${res.status}` }, cookies: [] };
  }

  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null;

  // A 200 without a usable pair is a broken upstream response, not a
  // credential verdict.
  if (!data?.access_token || !data.refresh_token) {
    return { session: { accessToken: null, outcome: "temporary", reason: "refresh_malformed_body" }, cookies: [] };
  }

  return {
    session: { accessToken: data.access_token, outcome: "ok" },
    cookies: sessionCookies(data.refresh_token, data.access_token, data.expires_in || 900),
  };
}

// Return a usable access token for this request, refreshing (and producing
// Set-Cookie updates) only when the cached one is missing or near expiry.
export async function ensureAccessToken(request: Request): Promise<Resolved> {
  const at = readCookie(request, AT);
  const exp = Number(readCookie(request, AT_EXP) || 0);
  const now = Math.floor(Date.now() / 1000);

  if (at && exp > now + SKEW) return { session: { accessToken: at, outcome: "ok" }, cookies: [] };

  const rt = readCookie(request, RT);
  if (!rt) return { session: { accessToken: null, outcome: "anonymous" }, cookies: [] };

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
  handler: (token: string | null, call: LoopCall, session: LoopSession) => Promise<Response>,
): Promise<Response> {
  const { session, cookies } = await ensureAccessToken(request);

  // We could not confirm who the caller is. Hand back a retryable error
  // instead of an anonymous world: falling through to "signed out" here is
  // what made a backend blip look like a forced logout.
  if (session.outcome === "temporary") {
    return Response.json(
      { error: "暂时无法确认登录状态，请稍后重试", code: "session_unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const accessToken = session.accessToken;

  const call: LoopCall = async (path, init = {}) => {
    try {
      return await fetch(`${loopApiBase()}${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          ...(init.headers || {}),
        },
        signal: init.signal ?? AbortSignal.timeout(upstreamTimeoutMs()),
      });
    } catch {
      // Timeout or lost connection. For a write the server may already have
      // applied the change, so this is deliberately *not* phrased as "please
      // try again" — a blind replay would double a ledger entry.
      return Response.json(
        { error: "网络连接中断，请先确认结果再重试", code: "upstream_unreachable" },
        { status: 504, headers: { "cache-control": "no-store" } },
      );
    }
  };

  const response = await handler(accessToken, call, session);
  return attachCookies(response, cookies);
}

// Read the refresh token straight from cookies (for logout).
export function refreshToken(request: Request): string | null {
  return readCookie(request, RT);
}
