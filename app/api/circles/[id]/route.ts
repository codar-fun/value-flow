import { withLoop } from "@/app/lib/loop";
import { toCircle, type LoopCircle } from "@/db/runtime";

export type CircleSettingsInput = {
  currency?: string;
  tagline?: string;
  joining?: "direct" | "approval";
  allowNegativeBalance?: boolean;
  requireConfirmation?: boolean;
  allowRejectCorrect?: boolean;
  references?: { name: string; value: string; note?: string }[];
  rules?: string[];
};

// PATCH /api/circles/:id — owner-only circle settings. loop merges the incoming
// `settings` onto the stored ones, so partial updates are safe.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = (await request.json().catch(() => ({}))) as CircleSettingsInput;

  const settings: Record<string, unknown> = {};
  if (input.allowNegativeBalance !== undefined) settings.allow_negative_balance = input.allowNegativeBalance;
  if (input.requireConfirmation !== undefined) settings.require_confirmation = input.requireConfirmation;
  if (input.allowRejectCorrect !== undefined) settings.allow_reject_correct = input.allowRejectCorrect;
  if (input.references !== undefined) settings.references = input.references;
  if (input.rules !== undefined) settings.rules = input.rules;

  const body: Record<string, unknown> = {};
  if (input.currency !== undefined) body.currency = input.currency.trim();
  if (input.tagline !== undefined) body.description = input.tagline.trim();
  if (input.joining !== undefined) body.joining = input.joining === "approval" ? "approval" : "direct";
  if (Object.keys(settings).length) body.settings = settings;

  if (!Object.keys(body).length) return Response.json({ error: "没有要保存的改动。" }, { status: 400 });

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call(`/circles/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as LoopCircle & { error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "保存失败" }, { status: res.status });
    return Response.json({ ok: true, circle: toCircle(data, data.member_ids ?? []) });
  });
}
