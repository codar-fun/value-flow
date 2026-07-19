import { withLoop } from "@/app/lib/loop";

// PUT /api/settings  {publicCards, publicListings, keepHiddenPrivate}
export async function PUT(request: Request) {
  const input = (await request.json().catch(() => ({}))) as {
    publicCards?: boolean;
    publicListings?: boolean;
    keepHiddenPrivate?: boolean;
  };

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const res = await call("/settings", {
      method: "PUT",
      body: JSON.stringify({
        public_cards: input.publicCards,
        public_listings: input.publicListings,
        keep_hidden_private: input.keepHiddenPrivate,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "保存失败" }, { status: res.status });
    return Response.json({ ok: true });
  });
}
