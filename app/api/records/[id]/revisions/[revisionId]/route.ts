import { withLoop } from "@/app/lib/loop";
import { relay } from "@/app/lib/relay";

// POST /api/records/:id/revisions/:revisionId  {action: "accept" | "decline" | "withdraw"}
export async function POST(request: Request, { params }: { params: Promise<{ id: string; revisionId: string }> }) {
  const { id, revisionId } = await params;
  const { action } = (await request.json().catch(() => ({}))) as { action?: string };
  if (!["accept", "decline", "withdraw"].includes(action || "")) return Response.json({ error: "操作无效。" }, { status: 400 });

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });
    const res = await call(`/records/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}/resolve`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    return relay(res, "处理失败");
  });
}
