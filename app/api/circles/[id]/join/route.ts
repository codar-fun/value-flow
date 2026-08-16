import { withLoop } from "@/app/lib/loop";

// POST /api/circles/:id/join  {note?} — ask to join a circle found on the
// discover page. Circles set to `approval` leave the membership pending until
// the owner accepts; loop decides, we just relay its answer.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { note } = (await request.json().catch(() => ({}))) as { note?: string };

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call(`/circles/${id}/join`, { method: "POST", body: JSON.stringify({ note }) });
    const data = (await res.json().catch(() => ({}))) as { status?: string; error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "加入失败" }, { status: res.status });
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
