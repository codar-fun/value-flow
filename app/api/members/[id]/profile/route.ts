import { withLoop } from "@/app/lib/loop";
import { relay } from "@/app/lib/relay";

// GET /api/members/:id/profile?circleId= — another member as the signed-in
// viewer may see them (the viewer comes from the session, not the URL).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const circleId = new URL(request.url).searchParams.get("circleId");
  const query = circleId ? `?circle_id=${encodeURIComponent(circleId)}` : "";
  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });
    return relay(await call(`/members/${encodeURIComponent(id)}/profile${query}`), "读取成员档案失败");
  });
}
