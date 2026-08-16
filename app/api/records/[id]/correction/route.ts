import { withLoop } from "@/app/lib/loop";

// POST /api/records/:id/correction  {action:"accept"|"decline"|"withdraw"}
// A correction proposed by one party only lands once the other accepts it, so
// this is where the ledger actually moves.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { action } = (await request.json().catch(() => ({}))) as { action?: string };
  if (!["accept", "decline", "withdraw"].includes(action ?? ""))
    return Response.json({ error: "操作无效。" }, { status: 400 });

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call(`/records/${id}/correction`, { method: "POST", body: JSON.stringify({ action }) });
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "更新失败" }, { status: res.status });
    return Response.json({ ok: true });
  });
}
