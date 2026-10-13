import { withLoop } from "@/app/lib/loop";

// POST /api/auth/profile  {username, display_name?} — finish first-time signup.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    display_name?: string;
    name?: string;
  };
  const nickname = (body.display_name || body.name || "").trim();
  if (!nickname || nickname.length > 40) return Response.json({ error: "请填写昵称（最多 40 字）。" }, { status: 400 });

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call("/auth/profile", {
      method: "POST",
      body: JSON.stringify({
        username: body.username,
        display_name: nickname,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { user?: unknown; error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "保存资料失败" }, { status: res.status });
    return Response.json({ user: data.user });
  });
}
