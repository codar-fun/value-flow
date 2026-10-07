import { loopApiBase, readCookie, runtimeEnv, upstreamTimeoutMs } from "@/app/lib/loop";

// Same-origin proxy for the platform admin console (H09).
//
// * Off unless FLOW_ADMIN_ENABLED=true is set for this process. Production
//   config doesn't set it, so the deployed site has no admin surface at all;
//   the admin runs the console locally against the real backend.
// * The admin's backend token lives only in its own HttpOnly, SameSite=Strict
//   cookie — it never appears in a JSON body the page can read, and the
//   member (OTP) session cookies are neither read nor touched.
// * Writes must come from this origin.
// * An upstream 404/405 means the backend route isn't there: say so, rather
//   than letting the page treat it as "no data".

export const ADMIN_COOKIE = "flow_admin";

export function adminEnabled(): boolean {
  return runtimeEnv("FLOW_ADMIN_ENABLED") === "true";
}

export function adminApiBase(): string {
  return (runtimeEnv("LOOP_ADMIN_API_BASE") || loopApiBase()).replace(/\/$/, "");
}

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });

function cookie(request: Request, value: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  return `${ADMIN_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") || new URL(request.url).host;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function proxyAdmin(request: Request, path: string[]): Promise<Response> {
  if (!adminEnabled()) return json({ error: "管理后台未启用" }, 404);
  const method = request.method.toUpperCase();
  if (method !== "GET" && !sameOrigin(request)) return json({ error: "只接受本站发起的请求" }, 403);

  const sub = "/" + path.map(encodeURIComponent).join("/");
  const query = new URL(request.url).search;
  const token = readCookie(request, ADMIN_COOKIE);
  const isLogin = sub === "/session" && method === "POST";
  const isLogout = sub === "/session" && method === "DELETE";
  if (!token && !isLogin) return json({ error: "管理员未登录", code: "admin_unauthenticated" }, 401);

  let upstream: Response;
  try {
    upstream = await fetch(`${adminApiBase()}/admin${sub}${query}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token && !isLogin ? { authorization: `Bearer ${token}` } : {}),
        // Lets the backend rate-limit failed logins per real client.
        ...(request.headers.get("x-forwarded-for") ? { "x-forwarded-for": request.headers.get("x-forwarded-for")! } : {}),
      },
      body: method === "GET" || method === "DELETE" ? undefined : await request.text(),
      signal: AbortSignal.timeout(upstreamTimeoutMs()),
    });
  } catch {
    // For a write the backend may already have applied it — never "retry".
    return json({ error: "连接管理接口失败，结果未知，请先查询再决定是否重试", code: "upstream_unreachable" }, 504);
  }

  if (upstream.status === 404 && !/\/[0-9a-f-]{36}/.test(sub)) return json({ error: "后端接口未接通", code: "admin_api_missing" }, 502);
  if (upstream.status === 405) return json({ error: "后端接口未接通", code: "admin_api_missing" }, 502);

  const data = (await upstream.json().catch(() => ({}))) as Record<string, unknown> & {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string; code?: string; rows?: unknown; batch_id?: string };
  };

  if (!upstream.ok) {
    const headers: Record<string, string> = upstream.status === 401 && !isLogin ? { "set-cookie": cookie(request, "", 0) } : {};
    return json({ error: data.error?.message || "请求失败", code: data.error?.code, rows: data.error?.rows, batchId: data.error?.batch_id }, upstream.status, headers);
  }

  if (isLogin) {
    if (!data.access_token) return json({ error: "登录响应缺少会话" }, 502);
    // The token goes into the cookie and nowhere else.
    return json({ admin: data.admin, expiresIn: data.expires_in }, 200, { "set-cookie": cookie(request, data.access_token, data.expires_in || 900) });
  }
  if (isLogout) return json({ ok: true }, 200, { "set-cookie": cookie(request, "", 0) });
  return json(data, 200);
}
