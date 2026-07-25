import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the flow circle shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /流动圈｜让帮助被记得/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("loop-backend is the only data source and identity provider", async () => {
  const [loop, runtime, bootstrap, records, profile] = await Promise.all([
    readFile(new URL("../app/lib/loop.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/runtime.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/bootstrap/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/records/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8"),
  ]);

  // Sessions live in httpOnly cookies, never in the client bundle.
  assert.match(loop, /LOOP_API_BASE/);
  assert.match(loop, /HttpOnly/);
  assert.match(loop, /auth\/refresh/);
  // The adapter maps loop's payload; it owns no storage of its own.
  assert.match(runtime, /toAppDatabase/);
  assert.match(runtime, /wechat_contact/);
  assert.match(runtime, /circle_accounts/);
  assert.match(bootstrap, /withLoop/);
  // The composer's three intents land in three different loop resources.
  assert.match(records, /\/circles\/\$\{input\.circleId\}\/records/);
  assert.match(records, /\/good-cards/);
  assert.match(records, /\/listings/);
  assert.match(profile, /wechat_contact/);
});

test("no AI assistant is wired up", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(page, /api\/assistant/);
  assert.doesNotMatch(page, /BUBBLE_ASSISTANT/);
  await assert.rejects(readFile(new URL("../app/api/assistant/draft/route.ts", import.meta.url), "utf8"));
});

test("keeps the confirmed product flows and visual language in source", async () => {
  const [page, types, css, readme] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  // The four record types, each with its own form.
  assert.match(page, /记一笔/);
  assert.match(page, /我想要/);
  assert.match(page, /我可以给/);
  assert.match(page, /好人卡/);
  // Three-tier visibility for aid records, per the product doc.
  assert.match(page, /神秘记录/);
  assert.match(page, /仅当事人/);
  // The mutual-aid toggles and the circle agreements loop stores in settings.
  assert.match(page, /允许负余额/);
  assert.match(page, /记录需要对方确认/);
  assert.match(page, /允许拒绝 \/ 更正/);
  assert.match(page, /CircleSettingsSheet/);
  assert.match(page, /EditProfileSheet/);
  // Corrections are proposed, then resolved by the other party.
  assert.match(page, /提议更正/);
  assert.match(page, /resolveCorrection/);
  // The owner's approval queue.
  assert.match(page, /在等你放行/);
  assert.match(page, /resolveRequest/);
  // A listing can span several circles, so posts filter on all of them.
  assert.match(page, /post\.circleIds\.includes/);
  // Mystery records arrive already redacted; the client trusts that flag.
  assert.match(page, /transaction\.redacted/);
  assert.match(types, /CircleSettings/);
  assert.match(types, /references/);
  assert.match(types, /PendingCorrection/);
  assert.match(types, /JoinRequest/);
  // No seeded demo identities remain.
  assert.doesNotMatch(page, /"qiao"|"ashu"|"village"|"human"/);
  // Neo-brutalism: hard shadows and heavy borders.
  assert.match(css, /box-shadow: \d+px \d+px 0/);
  assert.match(readme, /loop-backend/);
});
