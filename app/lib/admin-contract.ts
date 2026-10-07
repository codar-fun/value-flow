export type AdminCircle = { id: string; name: string; currency: string };
export type AdminMember = {
  account_id: string;
  display_name: string;
  username: string;
  balance: number;
  opening_balance: number | null;
  opening_balance_initialized: boolean;
};
export type OpeningDraft = {
  idempotency_key: string;
  source: string;
  as_of_date: string;
  note: string;
  entries: { account_id: string; opening_balance: number }[];
};
export type OpeningPreview = {
  preview_id: string;
  expires_at: string;
  total: number;
  entries: { account_id: string; display_name: string; current_balance: number; opening_balance: number; resulting_balance: number }[];
};
export type OpeningBatch = {
  batch_id: string;
  preview_id: string;
  idempotency_key: string;
  status: "completed" | "pending" | "failed";
  source: string;
  created_at: string;
  total: number;
  entries: { account_id: string; display_name: string; opening_balance: number; resulting_balance: number }[];
};

// Blank means "do not include", while an explicit zero is an initialization.
export function buildOpeningEntries(members: AdminMember[], amounts: Record<string, string>) {
  const entries: OpeningDraft["entries"] = [];
  for (const member of members) {
    const raw = amounts[member.account_id]?.trim() ?? "";
    if (!raw) continue;
    if (member.opening_balance_initialized) throw new Error(`${member.display_name}已经发放过初始积分`);
    if (!/^-?\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new Error(`${member.display_name}的积分须为安全范围内的整数`);
    entries.push({ account_id: member.account_id, opening_balance: Number(raw) });
  }
  if (!entries.length) throw new Error("请至少填写一位成员的初始积分");
  return entries;
}

export function validateOpeningPreview(value: unknown, entries: OpeningDraft["entries"]): OpeningPreview {
  const p = value as OpeningPreview;
  if (!p || typeof p.preview_id !== "string" || !p.preview_id || typeof p.expires_at !== "string" || !Number.isFinite(Date.parse(p.expires_at)) || !Array.isArray(p.entries) || p.entries.length !== entries.length) throw new Error("后端预览结果不完整，未开放确认发放");
  const seen = new Set<string>();
  for (const row of p.entries) {
    const requested = entries.find((entry) => entry.account_id === row.account_id);
    if (!requested || seen.has(row.account_id) || requested.opening_balance !== row.opening_balance || !Number.isSafeInteger(row.current_balance) || !Number.isSafeInteger(row.resulting_balance) || !Number.isSafeInteger(row.current_balance + row.opening_balance) || row.resulting_balance !== row.current_balance + row.opening_balance) throw new Error("后端预览与填写条目不一致，未开放确认发放");
    seen.add(row.account_id);
  }
  const total = entries.reduce((sum, entry) => sum + entry.opening_balance, 0);
  if (!Number.isSafeInteger(total) || p.total !== total) throw new Error("后端预览总额不一致，未开放确认发放");
  return p;
}

export function validateOpeningBatch(batch: OpeningBatch, preview: OpeningPreview, draft: OpeningDraft) {
  if (!batch?.batch_id || batch.status !== "completed" || batch.preview_id !== preview.preview_id || batch.idempotency_key !== draft.idempotency_key || batch.total !== preview.total || !Array.isArray(batch.entries) || batch.entries.length !== preview.entries.length) throw new Error("发放结果尚未核对一致，请查询原批次，勿另建重复批次");
  const seen = new Set<string>();
  for (const entry of batch.entries) {
    const expected = preview.entries.find((row) => row.account_id === entry.account_id);
    if (!expected || seen.has(entry.account_id) || entry.opening_balance !== expected.opening_balance || entry.resulting_balance !== expected.resulting_balance) throw new Error("发放条目尚未核对一致，请查询原批次，勿另建重复批次");
    seen.add(entry.account_id);
  }
  return batch;
}
