import { anonymousDatabase, toAppDatabase, type LoopBootstrap } from "../../../db/runtime";
import { withLoop } from "@/app/lib/loop";

export const dynamic = "force-dynamic";

// GET /api/bootstrap — the signed-in user's world, mapped from loop-backend.
// When not signed in, returns an empty world with session.authenticated=false
// so the UI can render its sign-in prompt instead of erroring.
export async function GET(request: Request) {
  return withLoop(request, async (token, call) => {
    if (!token) return Response.json(anonymousDatabase(), { headers: { "cache-control": "no-store" } });

    const res = await call("/bootstrap");
    if (!res.ok) {
      if (res.status === 401) return Response.json(anonymousDatabase());
      return Response.json({ error: "数据加载失败" }, { status: 502 });
    }

    const loop = (await res.json()) as LoopBootstrap;
    return Response.json(toAppDatabase(loop), { headers: { "cache-control": "no-store" } });
  });
}
