import { withLoop } from "@/app/lib/loop";
import { relay } from "@/app/lib/relay";

// GET /api/shares/:token/preview — public; one item, minimal fields.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return withLoop(request, async (_accessToken, call) =>
    relay(await call(`/shares/${encodeURIComponent(token)}/preview`), "这条分享已失效"),
  );
}
