import { runtimeEnv, loopApiBase, readCookie, upstreamTimeoutMs } from "./loop";

const COOKIE = "flow_admin_at";
export function adminEnabled() {
  const production = (typeof process !== "undefined" && process.env.NODE_ENV === "production") || runtimeEnv("NODE_ENV") === "production";
  return runtimeEnv("FLOW_ADMIN_ENABLED") === "true" && !production;
}
function reply(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}
function cookie(request: Request, value: string, maxAge: number) {
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
function withoutSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSecrets);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !/token|password|secret/i.test(key)).map(([key, item]) => [key, withoutSecrets(item)]));
  return value;
}

// This session is entirely separate from normal loop OTP/member cookies.
export async function proxyAdmin(request: Request, parts: string[]): Promise<Response> {
  if (!adminEnabled()) return reply({ error: "本地管理员入口未启用", code: "admin_disabled" }, 503);
  const method = request.method;
  const path = parts.join("/");
  const session = path === "session" && ["GET", "POST", "DELETE"].includes(method);
  const resource = method === "GET" && (path === "circles" || /^circles\/[^/]+\/members$/.test(path) || /^circles\/[^/]+\/opening-balance-imports(?:\/[^/]+)?$/.test(path))
    || method === "POST" && /^circles\/[^/]+\/opening-balance-imports\/(?:preview|[^/]+\/confirm)$/.test(path);
  if (!session && !resource || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return reply({ error: "管理员接口不存在" }, 404);
  if (method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "请求来源无效" }, 403);
  let token: string | null;
  try { token = readCookie(request, COOKIE); } catch { return reply({ error: "管理员会话无效" }, 401); }
  if (!(path === "session" && method === "POST") && !token) {
    return path === "session" && method === "GET" ? reply({ authenticated: false }) : reply({ error: "请先登录管理员后台" }, 401);
  }
  let body: string | undefined;
  if (method === "POST") {
    const input = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!input || typeof input !== "object") return reply({ error: "请求内容无效" }, 400);
    if (path === "session") {
      if (typeof input.password !== "string" || !input.password || input.password.length > 1024) return reply({ error: "请输入管理员密码" }, 400);
      body = JSON.stringify({ password: input.password });
    } else body = JSON.stringify(input);
  }
  const headers: Record<string, string> = { accept: "application/json" };
  if (body) headers["content-type"] = "application/json";
  if (token && !(path === "session" && method === "POST")) headers.authorization = `Bearer ${token}`;
  let response: Response;
  try {
    const base = (runtimeEnv("LOOP_ADMIN_API_BASE") || loopApiBase()).replace(/\/$/, "");
    const query = new URL(request.url).search;
    const upstream = await fetch(`${base}/admin/${parts.map(encodeURIComponent).join("/")}${query}`, { method, headers, body, cache: "no-store", signal: AbortSignal.timeout(upstreamTimeoutMs()) });
    if (upstream.status === 404 || upstream.status === 405) return reply({ error: "后端管理员接口尚未接通，请按交接文档提供接口", code: "admin_not_integrated" }, 503);
    const data = (upstream.status === 204 ? {} : await upstream.json().catch(() => null)) as { error?: string | { message?: string; code?: string; rows?: unknown }; access_token?: string; expires_in?: number; admin?: unknown } | null;
    if (!upstream.ok) {
      const message = typeof data?.error === "string" ? data.error : data?.error?.message || "后端拒绝了此次操作";
      const details = typeof data?.error === "object" ? data.error : undefined;
      response = reply({ error: upstream.status === 401 ? "管理员登录已失效或密码错误" : upstream.status === 403 ? "没有平台管理员权限" : upstream.status === 429 ? "尝试过于频繁，请稍后重试" : message, code: details?.code, rows: withoutSecrets(details?.rows) }, upstream.status);
      if (upstream.status === 401 && token) response.headers.append("set-cookie", cookie(request, "", 0));
      return response;
    }
    if (path === "session" && method === "POST") {
      if (typeof data?.access_token !== "string" || !data.access_token || typeof data.expires_in !== "number" || !Number.isFinite(data.expires_in) || data.expires_in <= 0 || !data.admin) return reply({ error: "管理员登录响应不符合契约，未建立会话" }, 502);
      response = reply({ authenticated: true, admin: withoutSecrets(data.admin) });
      response.headers.append("set-cookie", cookie(request, data.access_token, Math.min(Math.floor(data.expires_in), 86400)));
      return response;
    }
    if (data === null) return reply({ error: "后端管理员响应不是有效JSON" }, 502);
    response = reply(withoutSecrets(data));
    if (path === "session" && method === "DELETE") response.headers.append("set-cookie", cookie(request, "", 0));
    return response;
  } catch {
    // Never automatically replay a balance-changing request after a timeout.
    return reply({ error: method === "POST" && path.endsWith("/confirm") ? "无法确认发放结果，请查询批次或用同一预览重试，勿另建批次" : "无法连接管理员服务，请稍后重试", code: "admin_unavailable" }, 502);
  }
}
