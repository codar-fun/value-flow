import { withLoop } from "@/app/lib/loop";

type Intent = "record" | "need" | "offer" | "card";

// The draft shape returned by loop-backend's 泡泡助手. `fields` uses loop's
// snake_case keys and is posted back verbatim to /api/records.
export type AssistantDraft = {
  intent: Intent;
  title: string;
  detail: string;
  footer?: string;
  fields: Record<string, unknown>;
  source: "configured-api" | "local";
};

// POST /api/assistant/draft  {intent, text, circleId}
export async function POST(request: Request) {
  const { intent, text, circleId } = (await request.json().catch(() => ({}))) as {
    intent?: Intent;
    text?: string;
    circleId?: string;
  };

  if (!intent || !text?.trim() || !circleId)
    return Response.json({ error: "请写下内容并选择记录类型。" }, { status: 400 });

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call(`/circles/${circleId}/assistant/draft`, {
      method: "POST",
      body: JSON.stringify({ intent, text }),
    });

    const data = (await res.json().catch(() => ({}))) as { draft?: AssistantDraft; error?: { message?: string } };
    if (!res.ok || !data.draft)
      return Response.json({ error: data.error?.message || "泡泡助手暂时没有整理成功。" }, { status: res.status || 500 });

    return Response.json({ draft: data.draft });
  });
}
