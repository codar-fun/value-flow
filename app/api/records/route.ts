import { withLoop } from "@/app/lib/loop";
import type { AssistantDraft } from "../assistant/draft/route";

// POST /api/records  {draft} — the assistant's draft is committed to the right
// loop-backend endpoint based on its intent (record → aid record, need/offer →
// listing, card → good card). `draft.fields` uses loop's snake_case keys.
export async function POST(request: Request) {
  const { draft } = (await request.json().catch(() => ({}))) as { draft?: AssistantDraft };
  if (!draft) return Response.json({ error: "缺少草稿内容" }, { status: 400 });

  const f = (draft.fields || {}) as Record<string, unknown>;

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    let res: Response;

    if (draft.intent === "record") {
      res = await call(`/circles/${f.circle_id}/records`, {
        method: "POST",
        body: JSON.stringify({
          provider_id: f.provider_id,
          receiver_id: f.receiver_id,
          amount: f.amount,
          title: draft.title,
          story: draft.detail,
          visibility: f.visibility,
          tags: f.tags,
        }),
      });
    } else if (draft.intent === "card") {
      res = await call("/good-cards", {
        method: "POST",
        body: JSON.stringify({
          to_id: f.to_id,
          circle_id: f.circle_id,
          story: draft.detail,
          visibility: f.visibility,
        }),
      });
    } else {
      res = await call("/listings", {
        method: "POST",
        body: JSON.stringify({
          type: draft.intent,
          title: draft.title,
          detail: draft.detail,
          circle_ids: f.circle_ids,
          visibility: f.visibility,
          location: f.location,
          time: f.time,
          reference: f.reference,
          tags: f.tags,
        }),
      });
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "保存失败" }, { status: res.status });
    return Response.json({ ok: true, id: data.id }, { status: 201 });
  });
}
