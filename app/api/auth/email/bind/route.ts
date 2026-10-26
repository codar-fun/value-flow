import { readCookie, withLoop } from "@/app/lib/loop";
import { requestOrigin } from "@/app/lib/origin";
import { EMAIL_TICKET_COOKIE, clearEmailHint } from "@/app/lib/juluo-oauth";

// POST /api/auth/email/bind
// {} uses the HttpOnly ticket from the 聚落 callback.
// {email, code} proves a typed address with the existing email code, without
// creating a second account or replacing this session.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; code?: string };
  const ticket = readCookie(request, EMAIL_TICKET_COOKIE);

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    let upstream: { email_bind_token: string } | { email: string; code: string };
    if (body.email?.trim() && body.code?.trim()) {
      upstream = { email: body.email.trim(), code: body.code.trim() };
    } else if (ticket) {
      upstream = { email_bind_token: ticket };
    } else {
      return Response.json({ error: "绑定确认已过期，请重新登录后再绑定" }, { status: 400 });
    }

    const res = await call("/auth/email/bind", {
      method: "POST",
      body: JSON.stringify(upstream),
    });
    const data = (await res.json().catch(() => ({}))) as {
      merged?: boolean;
      user?: unknown;
      error?: { message?: string };
    };
    if (!res.ok) {
      return Response.json({ error: data.error?.message || "绑定失败" }, { status: res.status });
    }

    const response = Response.json({ merged: data.merged === true, user: data.user });
    return clearEmailHint(response, requestOrigin(request).startsWith("https:"));
  });
}
