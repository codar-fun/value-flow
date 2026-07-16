import { bodyJson, ensureDatabase, id, json, resolveCurrentMember, runtimeEnv } from "../../../db/runtime";
import type { AssistantDraft } from "../assistant/draft/route";

async function isMember(db:D1Database,circleId:string,memberId:string){return Boolean(await db.prepare("SELECT 1 ok FROM memberships WHERE circle_id=? AND member_id=? AND status='active'").bind(circleId,memberId).first());}
export async function POST(request: Request) {
  try {
    const {draft}=await bodyJson<{draft:AssistantDraft}>(request); const db=runtimeEnv().DB; await ensureDatabase(db); const me=await resolveCurrentMember(request,db); const now=Date.now(); const fields=draft.fields ?? {};
    const circleId=String(fields.circleId ?? (Array.isArray(fields.circleIds) ? fields.circleIds[0] : "")); if(!circleId || !await isMember(db,circleId,me)) return json({error:"你不能向这个圈子写入记录。"},{status:403});
    if(draft.intent === "need" || draft.intent === "offer") {
      const recordId=id("l"); const circleIds=Array.isArray(fields.circleIds) ? fields.circleIds.map(String) : [circleId];
      await db.batch([db.prepare("INSERT INTO listings (id,member_id,type,title,detail,circle_ids_json,visibility,location,time,reference,tags_json,status,nearby,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(recordId,me,draft.intent,draft.title,draft.detail,JSON.stringify(circleIds),String(fields.visibility ?? "circle"),String(fields.location ?? ""),String(fields.time ?? ""),String(fields.reference ?? ""),JSON.stringify(fields.tags ?? []),"active",0,now),db.prepare("INSERT INTO activities (source,source_id,circle_id,created_at) VALUES ('listing',?,?,?)").bind(recordId,circleId,now)]);
      return json({ok:true,id:recordId},{status:201});
    }
    if(draft.intent === "card") {
      const to=String(fields.toMemberId ?? ""); if(!to || !await isMember(db,circleId,to)) return json({error:"请选择同圈成员作为好人卡接收者。"},{status:400}); const recordId=id("c");
      await db.batch([db.prepare("INSERT INTO good_cards (id,from_member_id,to_member_id,story,tags_json,visibility,circle_id,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(recordId,me,to,draft.detail,JSON.stringify(fields.tags ?? []),String(fields.visibility ?? "cross-circle"),circleId,now),db.prepare("INSERT INTO activities (source,source_id,circle_id,created_at) VALUES ('card',?,?,?)").bind(recordId,circleId,now)]); return json({ok:true,id:recordId},{status:201});
    }
    const provider=String(fields.providerId ?? ""); const receiver=String(fields.receiverId ?? me); const amount=Math.trunc(Number(fields.amount)); if(!provider || !receiver || provider===receiver || !Number.isSafeInteger(amount) || amount<=0 || amount>100000) return json({error:"互助记录需要两位不同成员和大于 0 的整数额度。"},{status:400}); if(!await isMember(db,circleId,provider)||!await isMember(db,circleId,receiver)) return json({error:"交易双方都必须属于这个圈子。"},{status:400});
    const recordId=id("t"); await db.batch([
      db.prepare("INSERT INTO transactions (id,circle_id,provider_id,receiver_id,amount,title,story,happened_at,recorded_at,visibility,status,tags_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(recordId,circleId,provider,receiver,amount,draft.title,draft.detail,now,now,String(fields.visibility ?? "public"),"confirmed",JSON.stringify(fields.tags ?? [])),
      db.prepare("INSERT INTO accounts (id,circle_id,member_id,balance,given,received,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(circle_id,member_id) DO UPDATE SET balance=balance+excluded.balance,given=given+excluded.given,updated_at=excluded.updated_at").bind(`${circleId}:${provider}`,circleId,provider,amount,amount,0,now),
      db.prepare("INSERT INTO accounts (id,circle_id,member_id,balance,given,received,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(circle_id,member_id) DO UPDATE SET balance=balance+excluded.balance,received=received+excluded.received,updated_at=excluded.updated_at").bind(`${circleId}:${receiver}`,circleId,receiver,-amount,0,amount,now),
      db.prepare("INSERT INTO activities (source,source_id,circle_id,created_at) VALUES ('transaction',?,?,?)").bind(recordId,circleId,now),
    ]); return json({ok:true,id:recordId},{status:201});
  } catch(error){console.error(error); return json({error:error instanceof Error?error.message:"保存失败"},{status:500});}
}
