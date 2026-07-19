import { LOOP_API_BASE, attachCookies, sessionCookies } from "@/app/lib/loop";

// POST /api/auth/verify  {email, code} — exchange the code for a session,
// stored in httpOnly cookies. Returns {needs_profile, user}.
export async function POST(request: Request) {
  try {
    const { email, code } = (await request.json()) as { email?: string; code?: string };
    if (!email?.trim() || !code?.trim())
      return Response.json({ error: "请填写邮箱和验证码" }, { status: 400 });

    const res = await fetch(`${LOOP_API_BASE}/auth/otp/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim(), code: code.trim() }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      needs_profile?: boolean;
      user?: unknown;
      error?: { message?: string };
    };

    if (!res.ok || !data.access_token || !data.refresh_token)
      return Response.json({ error: data.error?.message || "验证码不正确" }, { status: res.status || 400 });

    const response = Response.json({ needs_profile: data.needs_profile, user: data.user });
    return attachCookies(
      response,
      sessionCookies(data.refresh_token, data.access_token, data.expires_in || 900),
    );
  } catch {
    return Response.json({ error: "登录失败" }, { status: 500 });
  }
}
