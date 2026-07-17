import { bodyJson, ensureDatabase, json, resolveCurrentMember, runtimeEnv } from "../../../db/runtime";

type ProfileInput = {
  name: string;
  role: string;
  wechat?: string;
};

export async function PUT(request: Request) {
  try {
    if (!request.headers.get("oai-authenticated-user-email")) {
      return json({ error: "请先使用 ChatGPT 登录。" }, { status: 401 });
    }

    const input = await bodyJson<ProfileInput>(request);
    const name = input.name?.trim();
    const role = input.role?.trim();
    const wechat = input.wechat?.trim() ?? "";
    if (!name || !role || name.length > 40 || role.length > 40 || wechat.length > 80) {
      return json({ error: "请填写昵称和你在社区里的角色。" }, { status: 400 });
    }

    const db = runtimeEnv().DB;
    await ensureDatabase(db);
    const memberId = await resolveCurrentMember(request, db);
    await db.prepare("UPDATE members SET name=?,initial=?,role=?,wechat=? WHERE id=?")
      .bind(name, name.slice(0, 1), role, wechat, memberId)
      .run();
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "建档失败" }, { status: 500 });
  }
}
