import { withLoop } from "@/app/lib/loop";
import { requestOrigin } from "@/app/lib/origin";

// POST /api/shares  {kind: "listing" | "record" | "good_card", targetId}
// Creates a public link to exactly one item; returns its full URL.
export async function POST(request: Request) {
  const { kind, targetId } = (await request.json().catch(() => ({}))) as { kind?: string; targetId?: string };
  if (!kind || !targetId) return Response.json({ error: "缺少要分享的内容。" }, { status: 400 });
  const origin = requestOrigin(request);

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });
    const res = await call("/shares", { method: "POST", body: JSON.stringify({ kind, target_id: targetId }) });
    const data = (await res.json().catch(() => ({}))) as { token?: string; path?: string; error?: { message?: string } };
    if (!res.ok || !data.path)
      return Response.json({ error: data.error?.message || "生成分享链接失败" }, { status: res.ok ? 502 : res.status });
    return Response.json({ token: data.token, url: `${origin}${data.path}` }, { status: 201 });
  });
}
