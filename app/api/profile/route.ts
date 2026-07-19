import { withLoop } from "@/app/lib/loop";

// PUT /api/profile  {name, role?, wechat?} — updates the display name on
// loop-backend. (loop has no per-user role/wechat; those fields are ignored.)
export async function PUT(request: Request) {
  const input = (await request.json().catch(() => ({}))) as { name?: string };
  const name = input.name?.trim();
  if (!name || name.length > 40) return Response.json({ error: "请填写昵称。" }, { status: 400 });

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call("/me", { method: "PATCH", body: JSON.stringify({ display_name: name }) });
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "建档失败" }, { status: res.status });
    return Response.json({ ok: true });
  });
}
