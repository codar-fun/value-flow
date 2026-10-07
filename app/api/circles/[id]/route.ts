import { withLoop } from "@/app/lib/loop";
import { toCircle, type LoopCircle } from "@/db/runtime";

export type CircleSettingsInput = {
  currency?: string;
  tagline?: string;
  joining?: "direct" | "approval";
  discoverability?: "public" | "invite_only";
  references?: { name: string; value: string; note?: string }[];
  rules?: string[];
};

// PATCH /api/circles/:id — owner-only circle settings. loop merges the incoming
// `settings` onto the stored ones, so partial updates are safe.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = (await request.json().catch(() => ({}))) as CircleSettingsInput;

  // The bookkeeping rules are fixed server-side; only the owner's agreements
  // and references are editable.
  const settings: Record<string, unknown> = {};
  if (input.references !== undefined) settings.references = input.references;
  if (input.rules !== undefined) settings.rules = input.rules;

  const body: Record<string, unknown> = {};
  if (input.currency !== undefined) body.currency = input.currency.trim();
  if (input.tagline !== undefined) body.description = input.tagline.trim();
  if (input.joining !== undefined) body.joining = input.joining === "approval" ? "approval" : "direct";
  if (input.discoverability !== undefined)
    body.discoverability = input.discoverability === "public" ? "public" : "invite_only";
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
