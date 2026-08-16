import { withLoop } from "@/app/lib/loop";

// DELETE /api/circles/:id/leave — leave the circle.
// loop refuses two cases and explains why: still owing the circle credits, or
// being the owner while other members remain (transfer first). Relay its
// message rather than inventing one — the reason is the whole point.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call(`/circles/${id}/members/me`, { method: "DELETE" });
    const data = (await res.json().catch(() => ({}))) as {
      status?: string;
      error?: { message?: string };
    };
    if (!res.ok) return Response.json({ error: data.error?.message || "退出失败" }, { status: res.status });
    return Response.json({ ok: true, status: data.status ?? "left" });
  });
}
