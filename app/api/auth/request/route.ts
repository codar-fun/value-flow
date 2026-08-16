import { LOOP_API_BASE } from "@/app/lib/loop";

// POST /api/auth/request  {email} — ask loop-backend to email a login code.
export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };
    if (!email?.trim()) return Response.json({ error: "请填写邮箱" }, { status: 400 });

    const res = await fetch(`${LOOP_API_BASE}/auth/otp/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });

    // loop replies 204 on success; never reveal whether the account exists.
    if (res.ok) return Response.json({ ok: true });

    // Pass through what the user can act on (rate limits, a malformed
    // address); anything else stays generic so we leak nothing.
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (res.status === 429 || res.status === 400)
      return Response.json({ error: data.error?.message || "发送验证码失败，请稍后再试" }, { status: res.status });
    return Response.json({ error: "发送验证码失败，请稍后再试" }, { status: 502 });
  } catch {
    return Response.json({ error: "发送验证码失败" }, { status: 500 });
  }
}
