import { withLoop } from "@/app/lib/loop";
import { normalizeTags } from "@/app/lib/content-search";

type ListingPatch = {
  status?: "active" | "paused" | "closed";
  detail?: string;
  reference?: string;
  visibility?: "circle" | "cross-circle";
  circleIds?: string[];
  tags?: string[];
  imageIds?: string[];
};

function legacyTitle(description: string) {
  const firstLine = description.split(/\r?\n/).find((line) => line.trim()) ?? description;
  return Array.from(firstLine.trim().replace(/\s+/g, " ")).slice(0, 60).join("");
}

// PATCH /api/listings/:id — status, or the owner's edited content. The
// external backend may still reject content fields until its edit contract is
// deployed; the UI verifies the refetched listing before reporting success.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = (await request.json().catch(() => ({}))) as ListingPatch;
  if (input.tags !== undefined && (!Array.isArray(input.tags) || input.tags.length > 12 || input.tags.some((tag) => typeof tag !== "string" || tag.length > 30))) return Response.json({ error: "标签无效。" }, { status: 400 });
  if (input.imageIds !== undefined && (!Array.isArray(input.imageIds) || input.imageIds.length > 3 || input.imageIds.some((id) => typeof id !== "string" || !id || id.length > 200))) return Response.json({ error: "图片最多 3 张。" }, { status: 400 });
  const editing = input.detail !== undefined;
  if (editing && (!input.detail?.trim() || !Array.isArray(input.circleIds) || input.circleIds.length === 0 || !["circle", "cross-circle"].includes(input.visibility ?? "")))
    return Response.json({ error: "请填写内容、可见范围并选择至少一个圈子。" }, { status: 400 });
  if (!editing && (!input.status || !["active", "paused", "closed"].includes(input.status)))
    return Response.json({ error: "状态无效。" }, { status: 400 });

  const body = editing
    ? { title: legacyTitle(input.detail!.trim()), detail: input.detail!.trim(), reference: input.reference?.trim() ?? "", visibility: input.visibility, circle_ids: input.circleIds, ...(input.tags !== undefined ? { tags: normalizeTags(input.tags) } : {}), ...(input.imageIds !== undefined ? { image_ids: input.imageIds } : {}) }
    : { status: input.status };

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call(`/listings/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "更新失败" }, { status: res.status });
    return Response.json({ ok: true, ...(editing ? {} : { status: input.status }) });
  });
}
