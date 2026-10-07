"use client";

import { useEffect, useState } from "react";
import { buildOpeningEntries, validateOpeningPreview, validateOpeningBatch, type AdminCircle, type AdminMember, type OpeningDraft, type OpeningPreview, type OpeningBatch } from "../lib/admin-contract";
import styles from "./admin.module.css";

class AdminError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, { method, cache: "no-store", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => null) as ({ error?: string; rows?: { index: number; message: string }[] } & T) | null;
  if (!response.ok) {
    const rows = Array.isArray(data?.rows) ? data.rows.map(row => `第 ${row.index + 1} 行：${row.message}`).join("；") : "";
    throw new AdminError([data?.error || "管理员服务返回错误", rows].filter(Boolean).join("；"), response.status);
  }
  if (!data) throw new AdminError("管理员服务响应不完整", 502);
  return data as T;
}
const today = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map((key) => parts.find((part) => part.type === key)?.value).join("-");
};
function list<T>(value: T[] | undefined): T[] {
  if (!Array.isArray(value)) throw new Error("后端列表响应不符合契约");
  return value;
}

export default function AdminConsole({ enabled }: { enabled: boolean }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(enabled);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [circles, setCircles] = useState<AdminCircle[]>([]);
  const [circleCursor, setCircleCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [circle, setCircle] = useState<AdminCircle | null>(null);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [memberCursor, setMemberCursor] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [source, setSource] = useState("社区已有积分台账");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<OpeningDraft | null>(null);
  const [preview, setPreview] = useState<OpeningPreview | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [batches, setBatches] = useState<OpeningBatch[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [completed, setCompleted] = useState<OpeningBatch | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    api<{ authenticated: boolean; admin?: { name: string } }>("session")
      .then((result) => { if (active) { setAuthenticated(result.authenticated === true); setName(result.admin?.name || "平台管理员"); } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "无法检查管理员登录状态"); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [enabled]);

  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await task(); }
    catch (e) {
      setError(e instanceof Error ? e.message : "无法连接管理员服务");
      if (e instanceof AdminError && e.status === 401) { setAuthenticated(false); setPassword(""); }
    } finally { setBusy(false); }
  }
  async function loadCircles(cursor?: string) {
    const params = new URLSearchParams({ q: query });
    if (cursor) params.set("cursor", cursor);
    const result = await api<{ circles: AdminCircle[]; next_cursor: string | null }>(`circles?${params}`);
    const rows = list(result.circles);
    setCircles((old) => cursor ? [...old, ...rows.filter((row) => !old.some((item) => item.id === row.id))] : rows);
    setCircleCursor(result.next_cursor || null);
  }
  async function chooseCircle(next: AdminCircle) {
    const result = await api<{ members: AdminMember[]; next_cursor: string | null }>(`circles/${encodeURIComponent(next.id)}/members`);
    setMembers(list(result.members)); setMemberCursor(result.next_cursor || null);
    setCircle(next); setAmounts({}); setPreview(null); setDraft(null); setAttempted(false); setCompleted(null); setBatches([]); setHistoryLoaded(false); setHistoryCursor(null);
  }
  async function moreMembers() {
    if (!circle || !memberCursor) return;
    const result = await api<{ members: AdminMember[]; next_cursor: string | null }>(`circles/${encodeURIComponent(circle.id)}/members?cursor=${encodeURIComponent(memberCursor)}`);
    const rows = list(result.members);
    setMembers((old) => [...old, ...rows.filter((row) => !old.some((item) => item.account_id === row.account_id))]);
    setMemberCursor(result.next_cursor || null);
  }
  async function buildPreview() {
    if (!circle) return;
    if (!source.trim() || !date) throw new Error("请填写积分来源和基准日期");
    const input: OpeningDraft = { idempotency_key: crypto.randomUUID(), source: source.trim(), as_of_date: date, note: note.trim(), entries: buildOpeningEntries(members, amounts) };
    const result = await api<OpeningPreview>(`circles/${encodeURIComponent(circle.id)}/opening-balance-imports/preview`, "POST", input);
    setPreview(validateOpeningPreview(result, input.entries)); setDraft(input); setAttempted(false); setCompleted(null);
  }
  async function confirm() {
    if (!circle || !preview || !draft) return;
    if (Date.parse(preview.expires_at) <= Date.now()) throw new Error(attempted ? "预览已过期，请查询原发放结果，勿新建重复批次" : "预览已过期，请返回填写并重新预览");
    setAttempted(true);
    try {
      const result = await api<{ batch: OpeningBatch }>(`circles/${encodeURIComponent(circle.id)}/opening-balance-imports/${encodeURIComponent(preview.preview_id)}/confirm`, "POST", { idempotency_key: draft.idempotency_key });
      if (!result.batch?.batch_id || result.batch.status !== "completed") throw new AdminError("发放尚未确认完成，请查询原发放结果", 502);
      setCompleted(validateOpeningBatch(result.batch, preview, draft)); setAmounts({});
    } catch (e) {
      // Unknown results remain locked to the same preview/key. A confirmed
      // validation rejection can go back to editing; never auto-replay writes.
      if (e instanceof AdminError && [400, 403, 409, 422].includes(e.status)) setAttempted(false);
      throw e;
    }
  }
  async function history(cursor?: string, lookup = false) {
    if (!circle) return;
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    if (lookup && preview) params.set("preview_id", preview.preview_id);
    const result = await api<{ batches: OpeningBatch[]; next_cursor: string | null }>(`circles/${encodeURIComponent(circle.id)}/opening-balance-imports?${params}`);
    const rows = list(result.batches);
    setBatches((old) => cursor ? [...old, ...rows] : rows); setHistoryCursor(result.next_cursor || null); setHistoryLoaded(true);
    if (lookup) {
      const done = rows.find((batch) => batch.status === "completed" && batch.preview_id === preview?.preview_id && batch.idempotency_key === draft?.idempotency_key);
      if (done && preview && draft) { setCompleted(validateOpeningBatch(done, preview, draft)); setAmounts({}); }
      else throw new Error("尚未查到已完成结果。保留当前预览，可查询或用同一批次重试；不要重新发放。");
    }
  }
  function resetDraft() { setPreview(null); setDraft(null); setAttempted(false); setError(""); }
  const locked = busy || !!preview;

  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.header}><div><span className={styles.eyebrow}>FLOW CIRCLE · ADMIN</span><h1>初始积分工作台</h1><p>为已经加入圈子的成员，记录社区原有的积分。</p></div>{authenticated && <div className={styles.account}><span>{name}</span><button disabled={busy} onClick={() => run(async () => { await api("session", "DELETE"); setAuthenticated(false); setCircles([]); setCircle(null); setMembers([]); setAmounts({}); resetDraft(); setCompleted(null); setBatches([]); })}>退出登录</button></div>}</header>
    {!enabled && <section className={styles.panel}><h2>本地后台尚未启用</h2><p>启动时设置 FLOW_ADMIN_ENABLED=true，再重新打开此页。生产构建不会启用管理接口。</p><p>管理员密码与发放权限由后端维护方开通。</p></section>}
    {error && <div className={styles.error} role="alert">{error}</div>}
    {checking ? <p role="status">正在检查管理员登录状态…</p> : enabled && !authenticated ? <section className={`${styles.panel} ${styles.login}`}><span className={styles.step}>01 · 管理员登录</span><h2>只有你能发放</h2><p>圈主先建圈，成员先注册并加入。初始积分由平台管理员集中设置。</p><form onSubmit={(event) => { event.preventDefault(); run(async () => {
      const result = await api<{ authenticated: boolean; admin: { name: string } }>("session", "POST", { password });
      if (!result.authenticated) throw new Error("管理员登录未获确认");
      setPassword(""); setName(result.admin?.name || "平台管理员"); setAuthenticated(true);
    }); }}><label>管理员密码<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy}/></label><button className={styles.primary} disabled={busy || !password}>{busy ? "正在登录…" : "登录工作台"}</button></form><small>后端接口未接通时，不能登录或发放积分。</small></section> : enabled && authenticated && <>
      <section className={styles.panel}><span className={styles.step}>01 · 选择圈子</span><form className={styles.search} onSubmit={(event) => { event.preventDefault(); run(() => loadCircles()); }}><label>搜索圈子<input value={query} placeholder="圈子名称" disabled={busy || !!preview} onChange={(event) => setQuery(event.target.value)}/></label><button disabled={busy || !!preview}>查询圈子</button></form><div className={styles.circles}>{circles.map((item) => <button key={item.id} aria-pressed={circle?.id === item.id} disabled={busy || !!preview} className={circle?.id === item.id ? styles.selected : ""} onClick={() => run(() => chooseCircle(item))}><strong>{item.name}</strong><span>{item.currency}</span></button>)}</div>{circleCursor && <button disabled={busy || !!preview} onClick={() => run(() => loadCircles(circleCursor))}>更多圈子</button>}</section>
      {circle && <section className={styles.panel}><span className={styles.step}>02 · 填写条目</span><h2>{circle.name}<small>{circle.currency}</small></h2><p>留空的成员不发放；填写 0 也会记为已初始化。每人仅发放一次，已有互助余额保留。</p><fieldset disabled={locked || !!completed} className={styles.fields}><label>积分来源<input value={source} onChange={(e) => setSource(e.target.value)} required/></label><label>基准日期<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required/></label><label className={styles.full}>备注（可选）<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}/></label></fieldset><div className={styles.tableWrap}><table><thead><tr><th>成员</th><th>当前余额</th><th>初始积分</th></tr></thead><tbody>{members.map((member) => <tr key={member.account_id}><td><strong>{member.display_name}</strong><small>{member.username}</small></td><td>{member.balance}</td><td>{member.opening_balance_initialized ? <span className={styles.badge}>已发放 {member.opening_balance}</span> : <input aria-label={`${member.display_name}的初始积分`} type="text" inputMode="numeric" placeholder="不发放" value={amounts[member.account_id] || ""} disabled={locked || !!completed} onChange={(e) => setAmounts((old) => ({ ...old, [member.account_id]: e.target.value }))}/>}</td></tr>)}</tbody></table></div>{members.length === 0 && <p>还没有已加入的成员，请先完成注册和入圈。</p>}{memberCursor && <button disabled={locked || !!completed} onClick={() => run(moreMembers)}>加载更多成员</button>}<p className={styles.note}>初始积分只进入余额，不计入给出、收到或互助笔数。</p>{!preview && !completed && <button className={styles.primary} disabled={busy || !members.length} onClick={() => run(buildPreview)}>{busy ? "正在核对…" : "预览发放条目 →"}</button>}</section>}
      {preview && !completed && <section className={`${styles.panel} ${styles.preview}`}><span className={styles.step}>03 · 确认发放</span><h2>{preview.entries.length} 位成员 · 共 {preview.total} {circle?.currency}</h2><p>{draft?.source} · 基准日期 {draft?.as_of_date}</p><div className={styles.tableWrap}><table><thead><tr><th>成员</th><th>当前余额</th><th>初始积分</th><th>发放后余额</th></tr></thead><tbody>{preview.entries.map((row) => <tr key={row.account_id}><td>{row.display_name}</td><td>{row.current_balance}</td><td>{row.opening_balance}</td><td><strong>{row.resulting_balance}</strong></td></tr>)}</tbody></table></div><small>预览有效至 {new Date(preview.expires_at).toLocaleString("zh-CN", { timeZone: "Asia/Taipei" })}</small>{attempted && <p className={styles.note}>此批次已提交过。结果未确认前请查询，重试也将使用同一批次。</p>}<div className={styles.actions}><button disabled={busy || attempted} onClick={resetDraft}>返回修改</button>{attempted && <button disabled={busy} onClick={() => run(() => history(undefined, true))}>查询原发放结果</button>}<button className={styles.primary} disabled={busy} onClick={() => run(confirm)}>{busy ? "正在处理…" : attempted ? "重试同一批次" : "确认发放初始积分"}</button></div></section>}
      {completed && <section className={`${styles.panel} ${styles.success}`} role="status"><h2>后端已确认发放完成</h2><p>批次 {completed.batch_id} · 合计 {completed.total} {circle?.currency}</p><p>初始积分不会增加互助统计。</p><button disabled={busy} onClick={() => run(async () => { if (circle) await chooseCircle(circle); })}>刷新成员与余额</button></section>}
      {circle && <section className={styles.panel}><div className={styles.actions}><h2>发放记录</h2><button disabled={busy} onClick={() => run(() => history())}>查询发放记录</button></div>{batches.map((batch) => <details key={batch.batch_id}><summary>{batch.source} · {batch.total} {circle.currency} · {batch.status === "completed" ? "已完成" : batch.status === "pending" ? "处理中" : "失败"}</summary><p>{batch.batch_id} · {batch.created_at}</p>{batch.entries.map((row) => <p key={row.account_id}>{row.display_name}：初始 {row.opening_balance}，发放后 {row.resulting_balance}</p>)}</details>)}{historyLoaded && !batches.length && <p>暂无发放记录。</p>}{historyCursor && <button disabled={busy} onClick={() => run(() => history(historyCursor))}>更多记录</button>}</section>}
    </>}
    <footer className={styles.footer}>平台管理员专用 · 圈主无发放权限 · 积分以真实后端账本为准</footer>
  </div></main>;
}
