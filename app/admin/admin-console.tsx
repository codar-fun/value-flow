"use client";
import { useEffect, useMemo, useState } from "react";

// Platform admin console (H09): give each member of a circle their starting
// credit from the community's existing ledger. Password login → pick a
// circle → type amounts per member → check the server's preview → confirm.
// Blank means "don't initialize"; 0 is an explicit initialization. Each
// member can be initialized once. All balances shown come from the server.

type Circle = { id: string; name: string; currency: string | null };
type Member = { account_id: string; display_name: string; username: string | null; balance: number; opening_balance: number | null; opening_balance_initialized: boolean };
type PreviewEntry = { account_id: string; display_name: string; current_balance: number; opening_balance: number; resulting_balance: number };
type Preview = { preview_id: string; expires_at: string; total: number; entries: PreviewEntry[] };
type Batch = { batch_id: string; preview_id: string | null; idempotency_key: string; status: string; source: string | null; as_of_date: string | null; created_at: string; total: number; entries: PreviewEntry[] };
type ApiError = { error?: string; code?: string; rows?: { index: number; account_id: string; message: string }[] };

async function api<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; status: number; error: ApiError }> {
  try {
    const response = await fetch(`/api/admin${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers || {}) }, cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    return response.ok ? { ok: true, data: body as T } : { ok: false, status: response.status, error: body as ApiError };
  } catch {
    return { ok: false, status: 0, error: { error: "网络中断，结果未知", code: "network" } };
  }
}

function time(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("zh-CN", { hour12: false });
}

export default function AdminConsole() {
  const [admin, setAdmin] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState("");
  const [circles, setCircles] = useState<Circle[]>([]);
  const [circlesCursor, setCirclesCursor] = useState<string | null>(null);
  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersCursor, setMembersCursor] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [source, setSource] = useState("社区现有积分台账");
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [key, setKey] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewIssue, setPreviewIssue] = useState("");
  // Set when a confirm's outcome is unknown (lost response): the preview and
  // key are kept, editing is locked, and the admin looks the result up.
  const [unknownOutcome, setUnknownOutcome] = useState(false);
  const [result, setResult] = useState<Batch | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<{ admin: { name: string } }>("/session").then((r) => setAdmin(r.ok ? r.data.admin.name : null));
  }, []);

  function sessionLost(status: number) {
    if (status === 401) { setAdmin(null); setMessage("管理员登录已失效，请重新登录"); return true; }
    return false;
  }

  async function login() {
    setBusy(true); setLoginError("");
    const r = await api<{ admin: { name: string } }>("/session", { method: "POST", body: JSON.stringify({ password }) });
    setBusy(false); setPassword("");
    if (r.ok) { setAdmin(r.data.admin.name); setMessage(""); void searchCircles(); }
    else setLoginError(r.error.error || "登录失败");
  }

  async function logout() {
    await api("/session", { method: "DELETE" });
    setAdmin(null); setCircle(null); setPreview(null); setResult(null);
  }

  async function searchCircles(cursor?: string) {
    const r = await api<{ circles: Circle[]; next_cursor: string | null }>(`/circles?q=${encodeURIComponent(query)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!r.ok) { if (!sessionLost(r.status)) setMessage(r.error.error || "查询失败"); return; }
    setCircles(cursor ? [...circles, ...r.data.circles] : r.data.circles);
    setCirclesCursor(r.data.next_cursor);
  }

  async function loadMembers(target: Circle, cursor?: string) {
    const r = await api<{ members: Member[]; next_cursor: string | null }>(`/circles/${target.id}/members${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!r.ok) { if (!sessionLost(r.status)) setMessage(r.error.error || "读取成员失败"); return; }
    setMembers(cursor ? [...members, ...r.data.members] : r.data.members);
    setMembersCursor(r.data.next_cursor);
  }

  async function loadBatches(target: Circle) {
    const r = await api<{ batches: Batch[] }>(`/circles/${target.id}/opening-balance-imports`);
    if (r.ok) setBatches(r.data.batches);
  }

  async function pick(target: Circle) {
    setCircle(target); setAmounts({}); setPreview(null); setResult(null); setUnknownOutcome(false); setMessage("");
    setKey(`opening-${target.id.slice(0, 8)}-${Date.now()}`);
    await Promise.all([loadMembers(target), loadBatches(target)]);
  }

  // Only rows with something typed; blank = not this time.
  const entries = useMemo(() => Object.entries(amounts).filter(([, v]) => v.trim() !== "").map(([account_id, v]) => ({ account_id, raw: v.trim() })), [amounts]);
  const invalid = entries.find((e) => !/^-?\d+$/.test(e.raw));

  async function requestPreview() {
    if (!circle || invalid || entries.length === 0) return;
    setBusy(true); setPreviewIssue(""); setMessage("");
    const r = await api<Preview>(`/circles/${circle.id}/opening-balance-imports/preview`, {
      method: "POST",
      body: JSON.stringify({ idempotency_key: key, source, as_of_date: asOf, note, entries: entries.map((e) => ({ account_id: e.account_id, opening_balance: Number(e.raw) })) }),
    });
    setBusy(false);
    if (!r.ok) {
      if (sessionLost(r.status)) return;
      setMessage([r.error.error, ...(r.error.rows ?? []).map((row) => `第 ${row.index + 1} 行：${row.message}`)].filter(Boolean).join("；"));
      return;
    }
    // The server is authoritative, but don't confirm anything that doesn't
    // match what was typed.
    const typed = new Map(entries.map((e) => [e.account_id, Number(e.raw)]));
    const issues: string[] = [];
    if (r.data.entries.length !== typed.size || r.data.entries.some((e) => typed.get(e.account_id) !== e.opening_balance)) issues.push("预览里的成员或金额和填写的不一致");
    if (r.data.entries.some((e) => e.current_balance + e.opening_balance !== e.resulting_balance)) issues.push("当前余额 + 初始积分 ≠ 发放后余额");
    if (r.data.entries.reduce((sum, e) => sum + e.opening_balance, 0) !== r.data.total) issues.push("总额不一致");
    setPreviewIssue(issues.join("；"));
    setPreview(r.data);
  }

  async function confirm() {
    if (!circle || !preview || previewIssue) return;
    setBusy(true); setMessage("");
    const r = await api<{ batch: Batch }>(`/circles/${circle.id}/opening-balance-imports/${preview.preview_id}/confirm`, { method: "POST", body: JSON.stringify({ idempotency_key: key }) });
    setBusy(false);
    if (r.ok) return finish(r.data.batch);
    if (sessionLost(r.status)) return;
    if (r.status === 0 || r.status === 504 || r.status >= 500) { setUnknownOutcome(true); setMessage("提交后没有收到结果，可能已经发放。请先查询结果，不要重新填写。"); return; }
    setMessage(r.error.error || "发放失败");
  }

  // After a lost response: look the batch up by its preview, or retry the
  // same confirm (the server returns the original batch, never a second one).
  async function lookUp() {
    if (!circle || !preview) return;
    setBusy(true);
    const r = await api<{ batches: Batch[] }>(`/circles/${circle.id}/opening-balance-imports?preview_id=${encodeURIComponent(preview.preview_id)}`);
    setBusy(false);
    if (!r.ok) { if (!sessionLost(r.status)) setMessage(r.error.error || "查询失败"); return; }
    const found = r.data.batches.find((b) => b.preview_id === preview.preview_id && b.idempotency_key === key);
    if (found) finish(found);
    else setMessage("没有查到这次发放的记录，可以再次点击「确认发放」重试（不会重复发放）。");
  }

  function finish(batch: Batch) {
    if (!preview || batch.preview_id !== preview.preview_id || batch.idempotency_key !== key || batch.status !== "completed") {
      setMessage("返回的批次和这次预览对不上，请刷新后核对"); return;
    }
    setResult(batch); setPreview(null); setUnknownOutcome(false); setAmounts({});
    if (circle) { setKey(`opening-${circle.id.slice(0, 8)}-${Date.now()}`); void loadMembers(circle); void loadBatches(circle); }
  }

  if (admin === undefined) return <main className="admin-page"><p>正在读取…</p></main>;

  if (admin === null) return <main className="admin-page"><section className="admin-card admin-login">
    <span>FLOW CIRCLE · 平台管理员</span><h1>管理员登录</h1>
    {message && <p className="admin-error">{message}</p>}
    <label>密码<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && password) void login(); }}/></label>
    {loginError && <p className="admin-error">{loginError}</p>}
    <button disabled={busy || !password} onClick={login}>{busy ? "正在登录…" : "登录"}</button>
    <small>密码由维护方开通和重置。普通成员的登录不能进入这里。</small>
  </section></main>;

  const currency = circle?.currency || "积分";
  return <main className="admin-page">
    <header className="admin-head"><div><span>FLOW CIRCLE · 平台管理员</span><h1>初始积分发放</h1></div><div><small>{admin}</small><button onClick={logout}>退出登录</button></div></header>
    {message && <p className="admin-error">{message}</p>}

    <section className="admin-card">
      <h2>1 · 选择圈子</h2>
      <div className="admin-row"><input placeholder="按圈名搜索" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void searchCircles(); }}/><button onClick={() => searchCircles()}>查询</button></div>
      <ul className="admin-list">{circles.map((c) => <li key={c.id}><button className={circle?.id === c.id ? "active" : ""} onClick={() => pick(c)}>{c.name}<small>{c.currency || "积分"}</small></button></li>)}</ul>
      {circlesCursor && <button className="admin-more" onClick={() => searchCircles(circlesCursor)}>加载更多</button>}
    </section>

    {circle && <section className="admin-card">
      <h2>2 · 逐人填写「{circle.name}」的初始积分</h2>
      <p className="admin-note">只列出已经加入这个圈子的成员；还没入圈的人请先让 TA 入圈。空白表示这次不发放，0 也算一次发放。每人只能发放一次。</p>
      <table className="admin-table"><thead><tr><th>成员</th><th>当前余额</th><th>已发初始积分</th><th>本次初始积分</th></tr></thead><tbody>
        {members.map((m) => <tr key={m.account_id}><td>{m.display_name}<small>{m.username ? `@${m.username}` : ""}</small></td><td>{m.balance}</td><td>{m.opening_balance_initialized ? m.opening_balance : "—"}</td>
          <td>{m.opening_balance_initialized ? <small>已发放，不能再次填写</small> : <input inputMode="numeric" disabled={Boolean(preview) || unknownOutcome} value={amounts[m.account_id] ?? ""} onChange={(e) => setAmounts({ ...amounts, [m.account_id]: e.target.value })} aria-label={`${m.display_name}的初始积分`}/>}</td></tr>)}
      </tbody></table>
      {membersCursor && <button className="admin-more" onClick={() => loadMembers(circle, membersCursor)}>加载更多成员</button>}
      <div className="admin-grid">
        <label>来源<input value={source} disabled={Boolean(preview)} onChange={(e) => setSource(e.target.value)}/></label>
        <label>积分基准日期<input type="date" value={asOf} disabled={Boolean(preview)} onChange={(e) => setAsOf(e.target.value)}/></label>
        <label className="wide">备注<input value={note} disabled={Boolean(preview)} onChange={(e) => setNote(e.target.value)}/></label>
      </div>
      {invalid && <p className="admin-error">初始积分必须是整数（可以为负）。</p>}
      {!preview && <button disabled={busy || entries.length === 0 || Boolean(invalid)} onClick={requestPreview}>{busy ? "正在预览…" : `预览（${entries.length} 人）`}</button>}
    </section>}

    {preview && <section className="admin-card">
      <h2>3 · 核对后确认</h2>
      <p className="admin-note">预览不会改动任何余额。预览有效至 {time(preview.expires_at)}；期间成员余额若有变化，需要重新预览。</p>
      <table className="admin-table"><thead><tr><th>成员</th><th>当前余额</th><th>初始积分</th><th>发放后余额</th></tr></thead><tbody>
        {preview.entries.map((e) => <tr key={e.account_id}><td>{e.display_name}</td><td>{e.current_balance}</td><td>{e.opening_balance}</td><td>{e.resulting_balance}</td></tr>)}
      </tbody><tfoot><tr><td>{preview.entries.length} 人</td><td/><td>{preview.total} {currency}</td><td/></tr></tfoot></table>
      {previewIssue && <p className="admin-error">{previewIssue}，不能确认。</p>}
      <div className="admin-row">
        {!unknownOutcome && <button className="secondary" disabled={busy} onClick={() => setPreview(null)}>返回修改</button>}
        {unknownOutcome && <button className="secondary" disabled={busy} onClick={lookUp}>查询这次发放的结果</button>}
        <button disabled={busy || Boolean(previewIssue)} onClick={confirm}>{busy ? "正在发放…" : unknownOutcome ? "用同一批次重试" : "确认发放"}</button>
      </div>
    </section>}

    {result && <section className="admin-card">
      <h2>已发放</h2>
      <p className="admin-note">批次 {result.batch_id} · {time(result.created_at)} · 共 {result.entries.length} 人 · {result.total} {currency}</p>
      <table className="admin-table"><thead><tr><th>成员</th><th>初始积分</th><th>发放时余额</th></tr></thead><tbody>
        {result.entries.map((e) => <tr key={e.account_id}><td>{e.display_name}</td><td>{e.opening_balance}</td><td>{e.resulting_balance}</td></tr>)}
      </tbody></table>
    </section>}

    {circle && <section className="admin-card">
      <h2>历史批次</h2>
      {batches.length === 0 ? <p className="admin-note">这个圈子还没有发放过。</p>
        : <ul className="admin-history">{batches.map((b) => <li key={b.batch_id}><b>{time(b.created_at)} · {b.entries.length} 人 · {b.total} {currency}</b><small>{b.source || "未注明来源"}{b.as_of_date ? ` · 基准 ${b.as_of_date}` : ""} · {b.status === "completed" ? "已完成" : b.status}</small></li>)}</ul>}
      <button className="admin-more" onClick={() => { void loadMembers(circle); void loadBatches(circle); }}>刷新余额与历史</button>
    </section>}
  </main>;
}
