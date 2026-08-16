import { withLoop } from "@/app/lib/loop";

// POST /api/invitations/:token — redeem an invite for the signed-in user.
// (loop requires authentication, so the invitee must be logged in first.)
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return withLoop(request, async (accessToken, call) => {
    if (!accessToken) return Response.json({ error: "请先登录再加入圈子。" }, { status: 401 });

    const res = await call(`/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as {
      status?: "active" | "pending";
      circle?: { name?: string };
      error?: { message?: string };
    };
    if (!res.ok)
      return Response.json({ error: data.error?.message || "加入失败" }, { status: res.status || 410 });

    return Response.json({ status: data.status || "active", circleName: data.circle?.name });
  });
}
