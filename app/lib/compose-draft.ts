export type ComposeDraft = { otherId: string; direction: "received" | "given"; amount: string; story: string; recordVisibility: "public" | "mystery"; listingDescription: string; reference: string; listingCircleIds: string[]; crossCircle: boolean; recordCircleId: string };
export function composeDraftKey(memberId: string, intent: string) { return "flow:compose-draft:v1:" + encodeURIComponent(memberId) + ":" + intent; }
export function readComposeDraft(key: string): Partial<ComposeDraft> {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "null");
    if (!raw || typeof raw !== "object") return {};
    const draft: Partial<ComposeDraft> = {};
    for (const field of ["otherId", "amount", "story", "listingDescription", "reference", "recordCircleId"] as const) if (typeof raw[field] === "string") draft[field] = raw[field];
    if (raw.direction === "received" || raw.direction === "given") draft.direction = raw.direction;
    if (raw.recordVisibility === "public" || raw.recordVisibility === "mystery") draft.recordVisibility = raw.recordVisibility;
    if (typeof raw.crossCircle === "boolean") draft.crossCircle = raw.crossCircle;
    if (Array.isArray(raw.listingCircleIds) && raw.listingCircleIds.every((id: unknown) => typeof id === "string")) draft.listingCircleIds = raw.listingCircleIds;
    return draft;
  } catch { return {}; }
}
export function writeComposeDraft(key: string, draft: ComposeDraft) { try { localStorage.setItem(key, JSON.stringify(draft)); } catch { /* Storage can be disabled. */ } }
export function clearComposeDraft(key: string) { try { localStorage.removeItem(key); } catch { /* Storage can be disabled. */ } }
