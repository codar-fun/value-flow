import assert from "node:assert/strict";
import test from "node:test";
import { composeDraftKey, readComposeDraft, writeComposeDraft, clearComposeDraft } from "../app/lib/compose-draft.ts";
const data = new Map();
globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
const draft = { otherId: "b", direction: "given", amount: "5", story: "多行\n草稿", recordVisibility: "mystery", listingDescription: "修电器", reference: "10", listingCircleIds: ["circle"], crossCircle: true, recordCircleId: "circle" };
test("drafts roundtrip separately for each account and intent and clear only the published draft", () => {
  const key = composeDraftKey("a", "record");
  writeComposeDraft(key, draft);
  assert.deepEqual(readComposeDraft(key), draft);
  assert.deepEqual(readComposeDraft(composeDraftKey("b", "record")), {});
  assert.deepEqual(readComposeDraft(composeDraftKey("a", "offer")), {});
  const other = composeDraftKey("a", "need");
  writeComposeDraft(other, draft);
  clearComposeDraft(key);
  assert.deepEqual(readComposeDraft(key), {});
  assert.deepEqual(readComposeDraft(other), draft);
});
test("corrupt or unavailable storage does not stop editing", () => {
  data.set("bad", "{"); assert.deepEqual(readComposeDraft("bad"), {});
  data.set("invalid", JSON.stringify({ story: 4, listingCircleIds: [7], direction: "invalid" }));
  assert.deepEqual(readComposeDraft("invalid"), {});
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw Error(); }, setItem() { throw Error(); }, removeItem() { throw Error(); } };
  assert.deepEqual(readComposeDraft("x"), {});
  assert.doesNotThrow(() => writeComposeDraft("x", draft));
  assert.doesNotThrow(() => clearComposeDraft("x"));
  globalThis.localStorage = saved;
});
