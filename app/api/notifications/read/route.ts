import { withLoop } from "@/app/lib/loop";

// POST /api/notifications/read — mark everything read. The list itself arrives
// with `GET /api/bootstrap`, so there is no GET counterpart here.
export async function POST(request: Request) {
  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call("/me/notifications/read", { method: "POST" });
    if (!res.ok) return Response.json({ error: "更新失败" }, { status: res.status });
    return Response.json({ ok: true });
  });
}
