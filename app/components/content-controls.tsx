"use client";
import { useEffect, useRef, useState } from "react";
import type { Member } from "../types";
import { CONTENT_TAGS, matchesSearch, normalizeTags, suggestedTags } from "../lib/content-search";

export function SearchControls({ query, onQuery, tags, tag, onTag }: { query: string; onQuery: (value: string) => void; tags: string[]; tag: string; onTag: (value: string) => void }) {
  return <div className="content-search"><label><span>搜索可见内容</span><input type="search" placeholder="正文、昵称、ID、圈子或标签" value={query} onChange={(event) => onQuery(event.target.value)}/></label><label><span>标签</span><select value={tag} onChange={(event) => onTag(event.target.value)}><option value="">全部标签</option>{[...new Set([...tags, ...(tag ? [tag] : [])])].sort().map((item) => <option key={item}>{item}</option>)}</select></label>{(query || tag) && <button className="text-link" onClick={() => { onQuery(""); onTag(""); }}>清除</button>}</div>;
}

export function TagPicker({ value, text, onChange }: { value: string[]; text: string; onChange: (tags: string[]) => void }) {
  const [custom, setCustom] = useState("");
  const suggested = suggestedTags(text);
  return <div className="tag-editor"><span className="form-label">分类标签（可选）</span><small>未选择时会按正文自动分类；选择后以你的标签为准。</small><div className="tag-options">{[...new Set([...CONTENT_TAGS, ...value])].map((tag) => <button type="button" key={tag} aria-pressed={value.includes(tag)} className={value.includes(tag) ? "active" : ""} onClick={() => onChange(value.includes(tag) ? value.filter((item) => item !== tag) : normalizeTags([...value, tag]))}>{tag}</button>)}</div>{!value.length && suggested.length > 0 && <small>自动建议：{suggested.join("、")}</small>}<div className="tag-custom"><input aria-label="自定义标签" value={custom} maxLength={30} placeholder="自定义标签，例如 地点:苏州" onChange={(event) => setCustom(event.target.value)}/><button type="button" className="secondary-button" onClick={() => { if (custom.trim()) { onChange(normalizeTags([...value, custom])); setCustom(""); } }}>添加</button><button type="button" className="text-link" onClick={() => onChange(["分类:其他"])}>其他</button></div></div>;
}

export function MemberPicker({ members, value, onChange, label, avatar }: { members: Member[]; value: string; onChange: (id: string) => void; label: string; avatar: (member: Member) => React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(!value);
  const selected = members.find((member) => member.id === value);
  const found = members.filter((member) => matchesSearch(query, member.name, member.handle, member.id, member.address));
  return <div className="member-picker"><span className="form-label">{label}</span>{selected && <button type="button" className="selected-person" onClick={() => setExpanded(!expanded)}>{avatar(selected)}<span><b>{selected.name}</b><small>{selected.handle} · ID {selected.id}</small></span><strong>更换</strong></button>}{expanded && <><input aria-label="搜索成员昵称或 ID" type="search" placeholder="搜索昵称、账号 ID 或地址" value={query} onChange={(event) => setQuery(event.target.value)}/><div className="member-picker-results">{found.map((member) => <button type="button" key={member.id} aria-pressed={value === member.id} onClick={() => { onChange(member.id); setExpanded(false); setQuery(""); }}>{avatar(member)}<span><b>{member.name}</b><small>{member.handle} · ID {member.id}</small></span></button>)}{!found.length && <p role="status">没有找到成员，试试完整 ID 或昵称。</p>}</div></>}</div>;
}

export function PullToRefresh({ children, enabled, onRefresh }: { children: React.ReactNode; enabled: boolean; onRefresh: () => Promise<void> }) {
  const element = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const action = useRef(onRefresh);
  useEffect(() => { action.current = onRefresh; }, [onRefresh]);
  async function run() { if (busyRef.current) return; busyRef.current = true; setBusy(true); try { await action.current(); } finally { setBusy(false); busyRef.current = false; setDistance(0); } }
  const runRef = useRef(run);
  useEffect(() => { runRef.current = run; });
  useEffect(() => {
    const node = element.current;
    if (!node || !enabled) return;
    let origin: { x: number; y: number } | null = null;
    let pull = 0;
    const start = (event: TouchEvent) => {
      const scroller = node.closest(".view-content");
      if (busyRef.current || event.touches.length !== 1 || (scroller?.scrollTop ?? 0) > 0 || window.scrollY > 0 || (event.target as HTMLElement).closest("input,textarea,select")) return;
      origin = { x: event.touches[0].clientX, y: event.touches[0].clientY }; pull = 0;
    };
    const move = (event: TouchEvent) => {
      if (!origin || event.touches.length !== 1) return;
      const dy = event.touches[0].clientY - origin.y;
      if (dy <= 0 || Math.abs(event.touches[0].clientX - origin.x) > dy) { origin = null; pull = 0; setDistance(0); return; }
      if (event.cancelable) event.preventDefault();
      pull = Math.min(110, dy * .55); setDistance(pull);
    };
    const end = () => { origin = null; if (pull >= 70) void runRef.current(); else setDistance(0); pull = 0; };
    const cancel = () => { origin = null; pull = 0; setDistance(0); };
    node.addEventListener("touchstart", start, { passive: true }); node.addEventListener("touchmove", move, { passive: false }); node.addEventListener("touchend", end); node.addEventListener("touchcancel", cancel);
    return () => { node.removeEventListener("touchstart", start); node.removeEventListener("touchmove", move); node.removeEventListener("touchend", end); node.removeEventListener("touchcancel", cancel); };
  }, [enabled]);
  return <div ref={element}>{enabled && <div className="pull-refresh" style={{ minHeight: distance || undefined }}><span role="status">{busy ? "正在刷新…" : distance >= 70 ? "松开刷新" : distance ? "继续下拉刷新" : "下拉刷新"}</span><button type="button" disabled={busy} onClick={() => void run()} aria-label="刷新内容">{busy ? "刷新中…" : "刷新 ↻"}</button></div>}{children}</div>;
}
