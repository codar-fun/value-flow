import { withLoop } from "@/app/lib/loop";
import { requestOrigin } from "@/app/lib/origin";
import { relay } from "@/app/lib/relay";

type LoopInvite = {
  id?: string;
  path?: string;
  type?: "regular" | "owner_direct";
  expires_at?: string;
  max_uses?: number | null;
  error?: { message?: string };
};

// POST /api/invitations  {circleId, type?: "regular" | "owner_direct", ttlSeconds?}
// Whether the caller may issue the type is decided by the backend (an
// owner_direct link needs the current owner), not by which button is shown.
export async function POST(request: Request) {
  const { circleId, type, ttlSeconds } = (await request.json().catch(() => ({}))) as {
    circleId?: string;
    type?: string;
    ttlSeconds?: number;
  };
  if (!circleId) return Response.json({ error: "缺少圈子。" }, { status: 400 });
  const origin = requestOrigin(request);

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call(`/circles/${encodeURIComponent(circleId)}/invitations`, {
      method: "POST",
      body: JSON.stringify({ type: type === "owner_direct" ? "owner_direct" : "regular", ttl_seconds: ttlSeconds }),
    });
    const data = (await res.json().catch(() => ({}))) as LoopInvite;
    if (!res.ok || !data.path)
      return Response.json(
        { error: data.error?.message || "邀请创建失败" },
        // A 2xx that somehow carries no path is still a failure here — don't
        // ship the error body under the upstream's success status.
        { status: res.ok ? 502 : res.status || 500 },
      );

    return Response.json(
      { id: data.id, url: `${origin}${data.path}`, type: data.type, expiresAt: data.expires_at, maxUses: data.max_uses ?? null },
      { status: 201 },
    );
  });
}

// GET /api/invitations?circleId= — live links I can manage in that circle.
export async function GET(request: Request) {
  const circleId = new URL(request.url).searchParams.get("circleId");
  if (!circleId) return Response.json({ error: "缺少圈子。" }, { status: 400 });
  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });
    return relay(await call(`/circles/${encodeURIComponent(circleId)}/invitations`), "读取邀请失败");
  });
}
