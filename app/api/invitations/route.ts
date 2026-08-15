import { withLoop } from "@/app/lib/loop";

// POST /api/invitations  {circleId} — mint an invite link via loop-backend and
// return a full share URL (loop returns a relative /join/<token> path).
export async function POST(request: Request) {
  const { circleId } = (await request.json().catch(() => ({}))) as { circleId?: string };
  if (!circleId) return Response.json({ error: "缺少圈子。" }, { status: 400 });

  // TLS terminates at the proxy, so `request.url` is http:// internally —
  // building the share link from it would hand people an insecure URL.
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const host = request.headers.get("x-forwarded-host") || url.host;
  const origin = `${proto || url.protocol.replace(":", "")}://${host}`;

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call(`/circles/${circleId}/invitations`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      path?: string;
      expires_at?: string;
      error?: { message?: string };
    };
    if (!res.ok || !data.path)
      return Response.json({ error: data.error?.message || "邀请创建失败" }, { status: res.status || 500 });

    return Response.json({ id: data.id, url: `${origin}${data.path}`, expiresAt: data.expires_at }, { status: 201 });
  });
}
