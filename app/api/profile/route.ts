import { withLoop } from "@/app/lib/loop";
import { isAvatarVariant } from "@/app/lib/avatar";

// PUT /api/profile  {name, bio?, wechat?, avatar?} — the editable part of a loop account
// (username and address are immutable). `wechat` is loop's `wechat_contact`,
// which loop only serves to people sharing a circle with you.
export async function PUT(request: Request) {
  const input = (await request.json().catch(() => ({}))) as {
    name?: string;
    bio?: string;
    wechat?: string;
    avatar?: string;
  };
  const name = input.name?.trim();
  if (!name || name.length > 40) return Response.json({ error: "请填写昵称。" }, { status: 400 });
  if ((input.bio?.trim().length ?? 0) > 80)
    return Response.json({ error: "简介最多 80 字。" }, { status: 400 });
  const avatar = isAvatarVariant(input.avatar) ? input.avatar : undefined;

  return withLoop(request, async (token, call) => {
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });

    const body: Record<string, string> = {
      display_name: name,
      bio: input.bio?.trim() ?? "",
      wechat_contact: input.wechat?.trim() ?? "",
    };
    if (avatar) body.avatar = avatar;
    const res = await call("/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) return Response.json({ error: data.error?.message || "保存失败" }, { status: res.status });
    return Response.json({ ok: true });
  });
}
