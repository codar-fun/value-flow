import { withLoop } from "@/app/lib/loop";

// CreateCircleView's input (a subset is used; extras are ignored).
type CircleInput = {
  name?: string;
  short?: string;
  currency?: string;
  tagline?: string;
  joining?: string;
  allowNegative?: boolean;
  requireConfirmation?: boolean;
  allowRejectCorrect?: boolean;
};

// loop requires a #RRGGBB color; pick a stable one from a small palette.
const PALETTE = ["#e8935a", "#7ec99a", "#6aa7d8", "#d98cae", "#e0b750"];
function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// POST /api/circles — create a mutual-aid circle on loop-backend.
export async function POST(request: Request) {
  const input = (await request.json().catch(() => ({}))) as CircleInput;
  if (!input.name?.trim() || !input.currency?.trim())
    return Response.json({ error: "请填写圈子名称和互助额度名称。" }, { status: 400 });

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call("/circles", {
      method: "POST",
      body: JSON.stringify({
        name: input.name!.trim(),
        icon: (input.short?.trim() || "✨").slice(0, 2),
        color: colorFor(input.name!),
        currency: input.currency!.trim(),
        description: input.tagline?.trim() || "",
        joining: input.joining === "approval" ? "approval" : "direct",
        settings: {
          // Per product decision, the create form defaults negative balances ON.
          allow_negative_balance: input.allowNegative ?? true,
          require_confirmation: input.requireConfirmation ?? false,
          allow_reject_correct: input.allowRejectCorrect ?? false,
        },
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "创建失败" }, { status: res.status });
    return Response.json({ ok: true, id: data.id }, { status: 201 });
  });
}
