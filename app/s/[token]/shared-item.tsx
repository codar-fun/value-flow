"use client";
import {useEffect,useState} from "react";
import Link from "next/link";

type Person = { display_name: string; avatar: string | null } | null;
type Shared =
  | { kind: "listing"; item: { type: "need" | "offer"; title: string; detail: string; reference: string; author: Person; circle_name: string | null; updated_at: string } }
  | { kind: "record"; item: { amount: number; currency: string | null; circle_name: string | null; title: string; story: string | null; provider: Person; receiver: Person; recorded_at: string } }
  | { kind: "good_card"; item: { story: string; to: Person; from: Person; circle_name: string | null; created_at: string } };

function day(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

// A publicly shared single item. A visitor sees only this one thing — no
// contacts, balances or anything else from the circle.
export default function SharedItem({token}:{token:string}){
  const [data,setData]=useState<Shared|"gone"|"error"|null>(null);
  useEffect(()=>{
    let alive=true;
    fetch(`/api/shares/${encodeURIComponent(token)}/preview`,{cache:"no-store"})
      .then(async(response)=>{const result=await response.json().catch(()=>({})) as Shared;if(!alive)return;setData(response.ok&&result.kind?result:response.status===410||response.status===404?"gone":"error");})
      .catch(()=>{if(alive)setData("error");});
    return()=>{alive=false;};
  },[token]);

  let body;
  if(data===null) body=<h1>正在打开…</h1>;
  else if(data==="gone") body=<><h1>这条分享已失效。</h1><p>分享人已经收回链接，或者内容已暂停、结束或撤销。</p></>;
  else if(data==="error") body=<><h1>暂时打不开。</h1><p>请稍后再试。</p></>;
  else if(data.kind==="listing") body=<><h1>{data.item.type==="need"?"我想要":"我可以给"}</h1><p className="multiline">{data.item.detail || data.item.title}</p><div><b>{data.item.author?.display_name??"一位成员"}{data.item.circle_name?` · ${data.item.circle_name}`:""}</b><p>{data.item.type==="need"?"愿意给出":"希望收到"}：{data.item.reference||"可商量"}{day(data.item.updated_at)?` · 更新于 ${day(data.item.updated_at)}`:""}</p></div></>;
  else if(data.kind==="record") body=<><h1>{data.item.title}</h1>{data.item.story&&<p className="multiline">{data.item.story}</p>}<div><b>{data.item.provider?.display_name??"成员"} 帮助了 {data.item.receiver?.display_name??"成员"}</b><p>{data.item.amount} {data.item.currency??"积分"}{data.item.circle_name?` · ${data.item.circle_name}`:""} · {day(data.item.recorded_at)}</p></div></>;
  else body=<><h1>{data.item.to?.display_name??"TA"} 的好人好事</h1><p className="multiline">“{data.item.story}”</p><div><b>来自 {data.item.from?.display_name??"一位成员"}{data.item.circle_name?` · ${data.item.circle_name}`:""}</b><p>{day(data.item.created_at)}</p></div></>;

  return <main className="join-page"><section className="join-card"><span>FLOW CIRCLE · 流动圈</span>{body}<Link href="/">了解流动圈</Link></section></main>;
}
