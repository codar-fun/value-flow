import { bodyJson, ensureDatabase, id, json, resolveCurrentMember, runtimeEnv } from "../../../../db/runtime";

type Intent = "record" | "need" | "offer" | "card";
export type AssistantDraft = { intent: Intent; title: string; detail: string; footer: string; fields: Record<string, unknown>; source: "configured-api" | "local" };

const defaultPrompt = `你是社区互助产品“流动圈”的泡泡助手。把用户自然语言整理成严格 JSON，不评价、不推销、不替用户承诺。intent 只能是 record、need、offer、card。输出 title、detail、footer、fields。record fields 包含 amount、providerId、receiverId；need/offer fields 包含 location、time、reference；card fields 包含 toMemberId。保留用户原意，缺失信息使用空字符串，不虚构敏感信息。`;

function localDraft(intent: Intent, text: string, circleId: string, currentMemberId: string, members: Array<{id:string;name:string}>, currency: string): AssistantDraft {
  const other = members.find((member) => member.id !== currentMemberId && text.includes(member.name));
  const amount = Number(text.match(/(\d+)\s*(?:个|点|泡泡|饭票|木屑)?/)?.[1] ?? 0);
  const clean = text.trim().replace(/[。！!]+$/, "");
  if (intent === "record") return { intent, title: amount ? `互助完成 · ${amount} ${currency}` : "一笔已经完成的互助", detail: clean, footer: `${other?.name ?? "对方"}与我 · ${circleId}`, fields: { circleId, providerId: other?.id ?? currentMemberId, receiverId: currentMemberId, amount, visibility: "public", tags: ["互助"] }, source: "local" };
  if (intent === "card") return { intent, title: `给${other?.name ?? "一位伙伴"}一张好人卡`, detail: clean, footer: "默认跨圈公开 · 不产生余额", fields: { circleId, toMemberId: other?.id ?? "", visibility: "cross-circle", tags: ["感谢"] }, source: "local" };
  return { intent, title: intent === "need" ? "我想要 · 新的请求" : "我可以给 · 新的提供", detail: clean, footer: `${circleId} · 可随时修改或关闭`, fields: { circleIds: [circleId], visibility: "circle", location: "", time: "", reference: "", tags: [intent === "need" ? "请求" : "提供"] }, source: "local" };
}

async function configuredDraft(intent: Intent, text: string, context: Record<string, unknown>): Promise<AssistantDraft | null> {
  const cfg = runtimeEnv(); if (!cfg.BUBBLE_ASSISTANT_API_URL || !cfg.BUBBLE_ASSISTANT_API_KEY || !cfg.BUBBLE_ASSISTANT_MODEL) return null;
  const url = new URL(cfg.BUBBLE_ASSISTANT_API_URL); if (url.protocol !== "https:") throw new Error("泡泡助手接口必须使用 HTTPS。");
  const response = await fetch(url, { method:"POST", headers:{"content-type":"application/json","authorization":`Bearer ${cfg.BUBBLE_ASSISTANT_API_KEY}`}, body:JSON.stringify({model:cfg.BUBBLE_ASSISTANT_MODEL,response_format:{type:"json_object"},messages:[{role:"system",content:cfg.BUBBLE_ASSISTANT_SYSTEM_PROMPT || defaultPrompt},{role:"user",content:JSON.stringify({intent,text,context})}],temperature:0.2}) });
  if (!response.ok) throw new Error(`泡泡助手接口返回 ${response.status}`);
  const payload = await response.json() as { choices?: Array<{message?:{content?:string}}> }; const content=payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("泡泡助手没有返回可用草稿。");
  const parsed=JSON.parse(content.replace(/^```json\s*|\s*```$/g,"")) as Omit<AssistantDraft,"source">;
  return {...parsed,intent,source:"configured-api"};
}

export async function POST(request: Request) {
  try {
    const input=await bodyJson<{intent:Intent;text:string;circleId:string}>(request); if(!["record","need","offer","card"].includes(input.intent) || !input.text?.trim() || input.text.length>2000) return json({error:"请写下 1—2000 字，并选择一种记录类型。"},{status:400});
    const db=runtimeEnv().DB; await ensureDatabase(db); const memberId=await resolveCurrentMember(request,db);
    const circle=await db.prepare("SELECT id,currency FROM circles WHERE id=?").bind(input.circleId).first<{id:string;currency:string}>(); if(!circle) return json({error:"圈子不存在。"},{status:404});
    const membership=await db.prepare("SELECT 1 AS ok FROM memberships WHERE circle_id=? AND member_id=? AND status='active'").bind(circle.id,memberId).first(); if(!membership) return json({error:"你还不是这个圈子的成员。"},{status:403});
    const memberRows=await db.prepare("SELECT m.id,m.name FROM members m JOIN memberships x ON x.member_id=m.id WHERE x.circle_id=? AND x.status='active'").bind(circle.id).all<{id:string;name:string}>();
    const context={circleId:circle.id,currency:circle.currency,currentMemberId:memberId,members:memberRows.results};
    const draft=await configuredDraft(input.intent,input.text,context) ?? localDraft(input.intent,input.text,circle.id,memberId,memberRows.results,circle.currency);
    await db.batch([db.prepare("INSERT INTO assistant_messages (id,member_id,role,content,intent,draft_json,created_at) VALUES (?,?,?,?,?,?,?)").bind(id("msg"),memberId,"user",input.text,input.intent,null,Date.now()),db.prepare("INSERT INTO assistant_messages (id,member_id,role,content,intent,draft_json,created_at) VALUES (?,?,?,?,?,?,?)").bind(id("msg"),memberId,"assistant",draft.detail,input.intent,JSON.stringify(draft),Date.now())]);
    return json({draft});
  } catch(error) { console.error(error); return json({error:error instanceof Error ? error.message : "泡泡助手暂时没有整理成功。"},{status:500}); }
}
