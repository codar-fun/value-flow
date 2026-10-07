"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import { BrandGlyph } from "../../components/identity";

type Preview = {
  type: "regular" | "owner_direct";
  expires_at: string;
  joins_as: "active" | "pending";
  viewer_status: "active" | "pending" | "left" | null;
  inviter: { display_name: string; handle: string | null } | null;
  circle: { name: string; description: string | null; currency: string | null; joining: "direct" | "approval"; member_count: number; rules: string[] };
};

function expiry(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// The invite link's landing page. It shows the circle first — reading the
// preview never accepts the invite or uses it up — and only joins when the
// person clicks. Signing in on the way returns here rather than joining.
export default function JoinInvitation({token}:{token:string}){
  const [preview,setPreview]=useState<Preview|null>(null);
  const [state,setState]=useState<"loading"|"ready"|"joining"|"active"|"pending"|"invalid"|"error"|"login">("loading");
  const [message,setMessage]=useState("");

  useEffect(()=>{
    let alive=true;
    fetch(`/api/invitations/${encodeURIComponent(token)}/preview`,{cache:"no-store"})
      .then(async(response)=>{
        const data=await response.json().catch(()=>({})) as Preview&{error?:string};
        if(!alive)return;
        if(response.status===410||response.status===404){setState("invalid");setMessage("邀请不存在、已过期或已撤销。");return;}
        if(!response.ok){setState("error");setMessage(data.error||"邀请暂时打不开，请稍后再试。");return;}
        setPreview(data);
        setState(data.viewer_status==="active"?"active":"ready");
      })
      .catch(()=>{if(alive){setState("error");setMessage("网络不太顺，请稍后再试。");}});
    return()=>{alive=false;};
  },[token]);

  async function join(){
    try{
      setState("joining");
      const response=await fetch(`/api/invitations/${encodeURIComponent(token)}`,{method:"POST"});
      if(response.status===401){setState("login");return;}
      const result=await response.json().catch(()=>({})) as {status?:"active"|"pending";error?:string};
      if(response.status===410||response.status===404){setState("invalid");setMessage("邀请不存在、已过期或已撤销。");return;}
      if(!response.ok)throw new Error(result.error||"加入失败");
      setState(result.status==="pending"?"pending":"active");
    }catch(error){setState("error");setMessage(error instanceof Error?error.message:"加入失败");}
  }

  const c=preview?.circle;
  const waiting=preview?.viewer_status==="pending"&&preview.joins_as==="pending";
  const title=state==="active"?"你已经在圈里了。":state==="pending"||waiting?"申请已经送出。":state==="invalid"?"这个邀请已经失效。":state==="login"?"先登录，再回来加入。":c?`加入「${c.name}」？`:"正在打开邀请…";

  return <main className="join-page"><section className="join-card">
    <div className="join-brand"><BrandGlyph/><span>FLOW CIRCLE · 圈子邀请</span></div>
    <h1>{title}</h1>
    {c&&state!=="invalid"&&<>
      {c.description&&<p className="multiline">{c.description}</p>}
      <dl className="join-facts">
        <div><dt>社区货币</dt><dd>{c.currency||"积分"}</dd></div>
        <div><dt>成员</dt><dd>{c.member_count} 位</dd></div>
        <div><dt>加入方式</dt><dd>{preview!.type==="owner_direct"?"圈主专属邀请，无需审批":c.joining==="approval"?"需要圈主审批":"直接加入"}</dd></div>
        <div><dt>邀请有效至</dt><dd>{expiry(preview!.expires_at)}{preview!.type==="regular"?" · 可多人使用":""}</dd></div>
        {preview!.inviter&&<div><dt>邀请人</dt><dd>{preview!.inviter.display_name}</dd></div>}
      </dl>
      {c.rules.length>0&&<div><b>圈子约定</b><ol className="join-rules">{c.rules.map((rule)=><li key={rule}>{rule}</li>)}</ol></div>}
      <div><b>加入之前，你始终可以知道</b><p>什么会被记录、谁能看见；你可以拒绝具体请求，也可以暂停或退出。记下的互助立即入账，修改或撤销需要双方同意。</p></div>
    </>}
    {state==="pending"||waiting?<p>圈主同意后你会收到通知。</p>:null}
    {(state==="invalid"||state==="error")&&<p>{message}</p>}
    {state==="login"?<Link href={`/?join=${encodeURIComponent(token)}`}>登录后回到这里</Link>
      :state==="ready"&&!waiting?<button onClick={join}>{preview?.joins_as==="pending"?"申请加入":"加入圈子"}</button>
      :state==="joining"?<button disabled>正在提交…</button>
      :state==="error"&&c?<button onClick={join}>再试一次</button>
      :state==="loading"?null:<Link href="/">回到流动圈</Link>}
  </section></main>;
}
