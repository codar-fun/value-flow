import { withLoop } from "@/app/lib/loop";

// POST /api/records/:id/confirm — accept a record someone else logged. Only
// reachable in circles with `require_confirmation` on, where a new record sits
// as `pending` and touches no balances until the other party confirms.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call(`/records/${id}/confirm`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "确认失败" }, { status: res.status });
    return Response.json({ ok: true });
  });
}
