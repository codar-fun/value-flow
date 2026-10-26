import { attachCookies, loopApiBase, readCookie, sessionCookies } from "@/app/lib/loop";
import { requestOrigin } from "@/app/lib/origin";
import {
  EMAIL_HINT_COOKIE,
  EMAIL_TICKET_COOKIE,
  allowedAppOrigin,
  hintCookie,
  oauthCookie,
} from "@/app/lib/juluo-oauth";

// GET /auth/callback — 聚落 returns here. We redeem the code on flow-backend,
// which holds the client secret, then set the normal session cookies.
export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const secure = origin.startsWith("https:");
  const url = new URL(request.url);
  const clearOauth = oauthCookie("", 0, secure);

  const fail = (code: string) => {
    const safe = /^[a-z0-9_]{1,40}$/.test(code) ? code : "juluo_rejected";
    const headers = new Headers({
      location: `${origin}/?login_error=${safe}`,
      "cache-control": "no-store",
    });
    headers.append("set-cookie", clearOauth);
    return new Response(null, { status: 302, headers });
  };

  if (!allowedAppOrigin(origin)) return fail("invalid_redirect");
  if (url.searchParams.get("error")) return fail("juluo_rejected");

  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const saved = readOAuthCookie(request);
  if (!code || !saved || !same(saved.state, state)) return fail("bad_request");

  try {
    const res = await fetch(`${loopApiBase()}/auth/juluo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: saved.verifier,
        redirect_uri: `${origin}/auth/callback`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      suggested_email?: string | null;
      email_bind_token?: string | null;
      error?: { code?: string };
    };
    if (!res.ok || !data.access_token || !data.refresh_token) {
      return fail(data.error?.code || "juluo_rejected");
    }

    const suggested = typeof data.suggested_email === "string" ? data.suggested_email : "";
    const ticket = typeof data.email_bind_token === "string" ? data.email_bind_token : "";
    const offerBind = suggested !== "" && ticket !== "";
    let response = new Response(null, {
      status: 302,
      headers: {
        location: offerBind ? `${origin}/?bind_email=1` : `${origin}/`,
        "cache-control": "no-store",
      },
    });
    response = attachCookies(
      response,
      sessionCookies(data.refresh_token, data.access_token, data.expires_in || 900),
    );
    response.headers.append("set-cookie", clearOauth);
    if (offerBind) {
      response.headers.append("set-cookie", hintCookie(EMAIL_HINT_COOKIE, suggested, 600, secure));
      response.headers.append("set-cookie", hintCookie(EMAIL_TICKET_COOKIE, ticket, 600, secure));
    }
    return response;
  } catch {
    return fail("juluo_unavailable");
  }
}

function readOAuthCookie(request: Request): { state: string; verifier: string } | null {
  const raw = readCookie(request, "flow_oauth");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: unknown; verifier?: unknown };
    if (typeof parsed.state !== "string" || typeof parsed.verifier !== "string") return null;
    if (!parsed.state || !parsed.verifier) return null;
    return { state: parsed.state, verifier: parsed.verifier };
  } catch {
    return null;
  }
}

function same(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}
