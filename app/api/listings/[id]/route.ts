import { withLoop } from "@/app/lib/loop";
import { relay } from "@/app/lib/relay";

type ListingEdit = {
  title?: string;
  detail?: string;
  reference?: string;
  visibility?: "circle" | "cross-circle";
  circleIds?: string[];
  status?: "active" | "paused" | "closed";
};

// PATCH /api/listings/:id — the author edits any of title/detail/reference/
// visibility/circles, or changes status. The backend refuses fields it can't
// store (it never answers 200 while ignoring them), so whatever comes back is
// what was saved.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = (await request.json().catch(() => ({}))) as ListingEdit;

  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.title = input.title;
  if (input.detail !== undefined) body.detail = input.detail;
  if (input.reference !== undefined) body.reference = input.reference;
  if (input.visibility !== undefined) body.visibility = input.visibility;
  if (input.circleIds !== undefined) body.circle_ids = input.circleIds;
  if (input.status !== undefined) {
    if (!["active", "paused", "closed"].includes(input.status)) return Response.json({ error: "状态无效。" }, { status: 400 });
    body.status = input.status;
  }
  if (!Object.keys(body).length) return Response.json({ error: "没有要保存的改动。" }, { status: 400 });

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });
    return relay(await call(`/listings/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }), "保存失败");
  });
}
