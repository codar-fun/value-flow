import { withLoop } from "@/app/lib/loop";

// New backend contract. Uploads remain private until linked to an authorized
// listing; the backend owns storage, image decoding and orphan cleanup.
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const key = form?.get("upload_key");
  if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024 || typeof key !== "string" || key.length > 100)
    return Response.json({ error: "请选择 JPG、PNG 或 WebP 图片，每张不超过 5 MB。" }, { status: 400 });
  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });
    const res = await call("/listing-images", { method: "POST", body: form! });
    const data = await res.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
    if (!res.ok || typeof data.id !== "string" || !data.id)
      return Response.json({ error: res.status === 404 || res.status === 501 ? "图片上传服务尚未接通，请保留正文并稍后重试。" : data.error?.message || "图片上传失败，请重试。" }, { status: res.ok ? 502 : res.status });
    return Response.json({ id: data.id }, { status: 201, headers: { "cache-control": "no-store" } });
  });
}
