import { withLoop } from "@/app/lib/loop";
import { relay } from "@/app/lib/relay";

// GET /api/circles/:id/preview — what a non-member may see of a circle.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });
    return relay(await call(`/circles/${encodeURIComponent(id)}/preview`), "读取圈子介绍失败");
  });
}
