import { withLoop } from "@/app/lib/loop";

// POST /api/circles/:id/join  {note?} — ask to join a circle found on the
// discover page. Circles set to `approval` leave the membership pending until
// the owner accepts; loop decides, we just relay its answer.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { note, sharedPost } = (await request.json().catch(() => ({}))) as { note?: string; sharedPost?: string };
  if (sharedPost && (typeof sharedPost !== "string" || !/^(listing|transaction|card):.+$/.test(sharedPost) || sharedPost.length > 250)) return Response.json({ error: "分享内容无效。" }, { status: 400 });

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    if (sharedPost) {
      const preview = await call(`/circles/${encodeURIComponent(id)}/preview?shared_post=${encodeURIComponent(sharedPost)}`);
      const entry = await preview.json().catch(() => ({})) as { shared_entry_supported?: boolean; can_apply?: boolean; membership_status?: string };
      if (!preview.ok || entry.shared_entry_supported !== true)
        return Response.json({ error: "分享入圈申请尚未接通，请联系圈主，稍后从这条链接继续。" }, { status: 501 });
      if (!entry.can_apply && entry.membership_status !== "active") return Response.json({ error: "当前不能申请加入，请刷新圈子介绍。" }, { status: 403 });
    }
    const res = await call(`/circles/${encodeURIComponent(id)}/join`, { method: "POST", body: JSON.stringify({ note, ...(sharedPost ? { shared_post: sharedPost, join_mode: "approval" } : {}) }) });
    const data = (await res.json().catch(() => ({}))) as { status?: string; error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "加入失败" }, { status: res.status });
    if (sharedPost && data.status !== "pending") return Response.json({ error: "入圈结果未返回待审批状态，请刷新确认并联系圈主。" }, { status: 502 });
    // loop decides whether this landed active or pending — relay its answer
    // rather than re-deriving it from the circle's joining mode.
    return Response.json({ ok: true, status: data.status ?? "active" });
  });
}

// DELETE /api/circles/:id/join — withdraw an application the owner hasn't
// answered yet. Without this an applicant can only wait.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call(`/circles/${id}/join`, { method: "DELETE" });
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "撤回失败" }, { status: res.status });
    return Response.json({ ok: true });
  });
}
