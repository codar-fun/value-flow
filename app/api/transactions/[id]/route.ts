import { withLoop } from "@/app/lib/loop";

// PATCH /api/transactions/:id  {action:"reject"|"correct", amount?, title?, story?}
// Maps to loop-backend's aid-record amend endpoint (requires the circle's
// allow_reject_correct toggle; loop enforces the ledger reversal/delta).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = (await request.json().catch(() => ({}))) as {
    action?: "reject" | "correct";
    amount?: number;
    title?: string;
    story?: string;
  };
  if (input.action !== "reject" && input.action !== "correct")
    return Response.json({ error: "操作无效。" }, { status: 400 });

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call(`/records/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        action: input.action,
        amount: input.amount,
        title: input.title,
        story: input.story,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { status?: string; error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "更新失败" }, { status: res.status });
    return Response.json({ ok: true, status: data.status });
  });
}
