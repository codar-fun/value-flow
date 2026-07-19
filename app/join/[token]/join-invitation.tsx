"use client";
import {useState} from "react";
import Link from "next/link";

export default function JoinInvitation({token}:{token:string}){
  const [state,setState]=useState<"ready"|"loading"|"active"|"pending"|"error"|"login">("ready");
  const [message,setMessage]=useState("你会先看到圈子的运行边界；加入不代表必须答应任何请求。");
  async function join(){
    try{
      setState("loading");
      const response=await fetch(`/api/invitations/${encodeURIComponent(token)}`,{method:"POST"});
      // loop-backend requires a session to accept an invite.
      if(response.status===401){setState("login");setMessage("请先登录流动圈，再回到这个邀请链接加入。");return;}
      const result=await response.json() as {status?:"active"|"pending";circleName?:string;error?:string};
      if(!response.ok)throw new Error(result.error||"加入失败");
      setState(result.status||"active");
      setMessage(result.status==="pending"?`已申请加入 ${result.circleName}，等待管理员确认。`:`已经加入 ${result.circleName}，可以回到流动圈了。`);
    }catch(error){setState("error");setMessage(error instanceof Error?error.message:"加入失败");}
  }
  return <main className="join-page"><section className="join-card"><span>FLOW CIRCLE · 圈子邀请</span><h1>{state==="active"?"欢迎来到圈里。":state==="pending"?"申请已经送出。":state==="login"?"先登录，再加入。":"有人邀请你，进入一段真实关系。"}</h1><p>{message}</p><div><b>加入之前，你始终可以知道</b><p>什么会被记录、谁能看见；你可以拒绝具体请求，也可以暂停或退出。</p></div>{state==="login"?<Link href={`/?join=${encodeURIComponent(token)}`}>前往登录</Link>:state==="ready"||state==="error"?<button onClick={join}>确认并继续</button>:state==="loading"?<button disabled>正在确认邀请…</button>:<Link href="/">回到流动圈</Link>}</section></main>;
}
