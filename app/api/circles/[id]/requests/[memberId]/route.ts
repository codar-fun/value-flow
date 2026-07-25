import { withLoop } from "@/app/lib/loop";

// POST /api/circles/:id/requests/:memberId  {action:"approve"|"decline"}
// Owner-only; loop enforces that and notifies the applicant on approval.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id, memberId } = await params;
  const { action } = (await request.json().catch(() => ({}))) as { action?: string };
  if (action !== "approve" && action !== "decline")
    return Response.json({ error: "操作无效。" }, { status: 400 });

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call(`/circles/${id}/requests/${memberId}`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "处理失败" }, { status: res.status });
    return Response.json({ ok: true });
  });
}
