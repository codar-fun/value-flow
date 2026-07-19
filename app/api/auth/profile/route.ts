import { withLoop } from "@/app/lib/loop";

// POST /api/auth/profile  {username, display_name?} — finish first-time signup.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    display_name?: string;
    name?: string;
  };

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call("/auth/profile", {
      method: "POST",
      body: JSON.stringify({
        username: body.username,
        display_name: body.display_name || body.name,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { user?: unknown; error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "保存资料失败" }, { status: res.status });
    return Response.json({ user: data.user });
  });
}
