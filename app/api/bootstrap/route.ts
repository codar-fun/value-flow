import { json, loadBootstrap } from "../../../db/runtime";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { return json(await loadBootstrap(request)); }
  catch (error) { console.error(error); return json({ error: error instanceof Error ? error.message : "加载失败" }, { status: 500 }); }
}
