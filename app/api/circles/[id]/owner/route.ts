import { withLoop } from "@/app/lib/loop";

// POST /api/circles/:id/owner  {memberId} — hand the circle to a co-member.
// Owner-only; loop enforces that and that the recipient is an active member.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { memberId } = (await request.json().catch(() => ({}))) as { memberId?: string };
  if (!memberId) return Response.json({ error: "请选择新的圈主。" }, { status: 400 });

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call(`/circles/${id}/owner`, {
      method: "POST",
      body: JSON.stringify({ account_id: memberId }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "转让失败" }, { status: res.status });
    return Response.json({ ok: true });
  });
}
