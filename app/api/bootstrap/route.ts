import { anonymousDatabase, toAppDatabase, type LoopBootstrap } from "../../../db/runtime";
import { attachCookies, clearedCookies, withLoop } from "@/app/lib/loop";

export const dynamic = "force-dynamic";

// GET /api/bootstrap — the signed-in user's world, mapped from loop-backend.
// When not signed in, returns an empty world with session.authenticated=false
// so the UI can render its sign-in prompt instead of erroring.
export async function GET(request: Request) {
  return withLoop(request, async (token, call) => {
    if (!token) return Response.json(anonymousDatabase(), { headers: { "cache-control": "no-store" } });

    const res = await call("/bootstrap");
    if (!res.ok) {
      // We held a token the backend now rejects: the session really is over,
      // so drop the cookies instead of leaving a dead session around.
      if (res.status === 401) {
        return attachCookies(
          Response.json(anonymousDatabase(), { headers: { "cache-control": "no-store" } }),
          clearedCookies(),
        );
      }
      return Response.json({ error: "数据加载失败" }, { status: 502, headers: { "cache-control": "no-store" } });
    }

    const loop = (await res.json()) as LoopBootstrap;
    return Response.json(toAppDatabase(loop), { headers: { "cache-control": "no-store" } });
  });
}
