import { withLoop } from "@/app/lib/loop";
import { relay } from "@/app/lib/relay";

// GET /api/invitations/:token/preview — no login needed. Reading it never
// accepts the invite or uses it up; a signed-in reader also learns their own
// standing in the circle.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return withLoop(request, async (_accessToken, call) =>
    relay(await call(`/invitations/${encodeURIComponent(token)}/preview`), "邀请已失效或不存在"),
  );
}
