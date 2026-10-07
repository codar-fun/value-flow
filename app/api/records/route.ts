import { withLoop } from "@/app/lib/loop";

// POST /api/records — the composer's single write endpoint. `intent` decides
// which loop-backend endpoint the entry lands in; loop keeps them in three
// separate resources (aid records / listings / good cards).
export type ComposeInput =
  | {
      intent: "record";
      circleId: string;
      providerId: string;
      receiverId: string;
      amount: number;
      description?: string;
      title?: string;
      story?: string;
      visibility?: "public" | "mystery";
      tags?: string[];
      // Same key ⇒ same record: the backend replays the original instead of
      // posting again. The composer mints one per draft.
      idempotencyKey?: string;
    }
  | {
      intent: "card";
      circleId: string;
      toId: string;
      story: string;
      visibility?: "cross-circle";
    }
  | {
      intent: "need" | "offer";
      description?: string;
      title?: string;
      detail?: string;
      circleIds: string[];
      visibility?: "circle" | "cross-circle";
      reference?: string;
      tags?: string[];
    };

// The current UI has one text field. Keep the full text in story/detail and
// derive a short legacy title only while loop-backend still requires it.
function legacyTitle(description: string) {
  const firstLine = description.split(/\r?\n/).find((line) => line.trim()) ?? description;
  return Array.from(firstLine.trim().replace(/\s+/g, " ")).slice(0, 60).join("");
}

export async function POST(request: Request) {
  const input = (await request.json().catch(() => null)) as ComposeInput | null;
  if (!input?.intent) return Response.json({ error: "缺少内容" }, { status: 400 });

  // Reject obsolete choices rather than silently making a private draft public.
  if (input.intent === "record" && input.visibility !== undefined && input.visibility !== "public" && input.visibility !== "mystery")
    return Response.json({ error: "记一笔仅支持圈内公开或神秘记录，请重新选择。" }, { status: 400 });
  if (input.intent === "card" && input.visibility !== undefined && input.visibility !== "cross-circle")
    return Response.json({ error: "好人好事为跨圈公开，请确认内容后重新发布。" }, { status: 400 });

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    let res: Response;

    if (input.intent === "record") {
      if (!input.circleId || !input.providerId || !input.receiverId)
        return Response.json({ error: "请选择圈子和双方成员。" }, { status: 400 });
      if (!Number.isInteger(input.amount) || input.amount <= 0)
        return Response.json({ error: "社区货币数量必须是大于 0 的整数。" }, { status: 400 });
      const description = (input.description ?? input.story ?? input.title ?? "").trim();
      if (!description) return Response.json({ error: "请写下这次互助发生了什么。" }, { status: 400 });

      res = await call(`/circles/${input.circleId}/records`, {
        method: "POST",
        body: JSON.stringify({
          provider_id: input.providerId,
          receiver_id: input.receiverId,
          amount: input.amount,
          title: legacyTitle(description),
          story: description,
          visibility: input.visibility ?? "public",
          tags: input.tags ?? [],
          idempotency_key: input.idempotencyKey,
        }),
      });
    } else if (input.intent === "card") {
      if (!input.toId || !input.story?.trim())
        return Response.json({ error: "请选择成员并写下发生了什么。" }, { status: 400 });

      res = await call("/good-cards", {
        method: "POST",
        body: JSON.stringify({
          to_id: input.toId,
          circle_id: input.circleId,
          story: input.story,
          visibility: "cross-circle",
        }),
      });
    } else {
      const description = (input.description ?? input.detail ?? input.title ?? "").trim();
      if (!description) return Response.json({ error: "请写下你想要或可以给什么。" }, { status: 400 });
      if (!input.circleIds?.length)
        return Response.json({ error: "请至少选择一个圈子。" }, { status: 400 });

      res = await call("/listings", {
        method: "POST",
        body: JSON.stringify({
          type: input.intent,
          title: legacyTitle(description),
          detail: description,
          circle_ids: input.circleIds,
          visibility: input.visibility ?? "circle",
          reference: input.reference ?? "",
          tags: input.tags ?? [],
        }),
      });
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "保存失败" }, { status: res.status });
    return Response.json({ ok: true, id: data.id }, { status: 201 });
  });
}
