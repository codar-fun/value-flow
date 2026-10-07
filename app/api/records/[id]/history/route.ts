import { withLoop } from "@/app/lib/loop";
import { relay } from "@/app/lib/relay";

// GET /api/records/:id/history — every proposal on a record; its two parties only.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });
    return relay(await call(`/records/${encodeURIComponent(id)}/history`), "读取修改记录失败");
  });
}
