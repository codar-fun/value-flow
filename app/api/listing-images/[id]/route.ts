import { withLoop } from "@/app/lib/loop";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });
    const response = await call(`/listing-images/${encodeURIComponent(id)}`);
    if (!response.ok) return Response.json({ error: "图片暂时无法查看，或你没有访问权限。" }, { status: response.status });
    const type = response.headers.get("content-type")?.split(";")[0];
    if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type)) return Response.json({ error: "图片格式无效。" }, { status: 502 });
    return new Response(response.body, { headers: { "content-type": type, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  });
}
