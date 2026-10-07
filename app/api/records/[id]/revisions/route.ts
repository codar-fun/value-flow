import { withLoop } from "@/app/lib/loop";
import { relay } from "@/app/lib/relay";

// POST /api/records/:id/revisions
// {kind: "edit" | "revoke", baseVersion, amount?, story?, visibility?}
// Proposes a change; nothing moves until the other party accepts it.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = (await request.json().catch(() => ({}))) as {
    kind?: string;
    baseVersion?: number;
    amount?: number;
    story?: string;
    visibility?: string;
  };
  if (input.kind !== "edit" && input.kind !== "revoke") return Response.json({ error: "操作无效。" }, { status: 400 });

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });
    const res = await call(`/records/${encodeURIComponent(id)}/revisions`, {
      method: "POST",
      body: JSON.stringify({
        kind: input.kind,
        base_version: input.baseVersion,
        amount: input.amount,
        story: input.story,
        visibility: input.visibility,
      }),
    });
    return relay(res, "提交失败");
  });
}
