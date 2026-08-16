import { withLoop } from "@/app/lib/loop";

// PATCH /api/listings/:id  {status} — pause/close/reopen a listing.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status } = (await request.json().catch(() => ({}))) as { status?: string };
  if (!status || !["active", "paused", "closed"].includes(status))
    return Response.json({ error: "状态无效。" }, { status: 400 });

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call(`/listings/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "更新失败" }, { status: res.status });
    return Response.json({ ok: true, status });
  });
}
