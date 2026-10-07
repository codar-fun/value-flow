import { withLoop } from "@/app/lib/loop";
import { relay } from "@/app/lib/relay";

// DELETE /api/shares/:token — take a public link down (its creator only).
export async function DELETE(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return withLoop(request, async (accessToken, call) => {
    if (!accessToken) return Response.json({ error: "未登录" }, { status: 401 });
    return relay(await call(`/shares/${encodeURIComponent(token)}`, { method: "DELETE" }), "撤回失败");
  });
}
