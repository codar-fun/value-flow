import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
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

test("renders the community currency demo shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /流动圈｜让帮助被记得/);
  assert.match(html, /我的圈子动态/);
  assert.match(html, /泡泡助手/);
  assert.match(html, /说一句/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("includes the persistent backend and configurable assistant contract", async () => {
  const [schema, runtime, records, assistant, environment, hosting] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/runtime.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/records/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/assistant/draft/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /transactions/);
  assert.match(schema, /invitations/);
  assert.match(runtime, /ensureDatabase/);
  assert.match(records, /INSERT INTO activities/);
  assert.match(assistant, /BUBBLE_ASSISTANT_API_URL/);
  assert.match(environment, /BUBBLE_ASSISTANT_API_KEY=/);
  assert.match(hosting, /"d1": "DB"/);
});

test("keeps the confirmed product flows, handoff facts, and visual language in source", async () => {
  const [page, data, css, readme, handoff, productDoc, dataDoc, designDoc] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/demo-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/开发交付说明.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/产品需求文档：运营流程.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/静态演示数据库.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/静态演示设计系统.md", import.meta.url), "utf8"),
  ]);

  assert.match(data, /俏也交换圈/);
  assert.match(data, /做人共学/);
  assert.match(data, /龙潭生活营地/);
  assert.match(data, /goodCards/);
  assert.match(data, /transactions/);
  assert.match(data, /listings/);
  assert.match(page, /记一笔/);
  assert.match(page, /我想要/);
  assert.match(page, /我可以给/);
  assert.match(page, /好人卡/);
  assert.match(page, /FLOW CIRCLE/);
  assert.match(page, /AboutView/);
  assert.match(page, /CreateCircleView/);
  assert.match(page, /圈子身份/);
  assert.match(page, /互助设置/);
  assert.match(page, /成员与边界/);
  assert.match(page, /预览确认/);
  assert.match(page, /不与人民币兑换/);
  assert.match(page, /关于流动圈/);
  assert.match(page, /让帮助被记得/);
  assert.match(page, /setView\("about"\)/);
  assert.match(page, /圈子介绍/);
  assert.match(page, /全部成员/);
  assert.match(page, /查看规则/);
  assert.match(page, /邀请成员/);
  assert.match(page, /DiscoverFilter/);
  assert.match(page, /feedCircleId/);
  assert.match(page, /post\.circleId !== feedCircleId/);
  assert.match(page, /全部圈子/);
  assert.match(page, /EVENTS IN THIS CIRCLE/);
  assert.doesNotMatch(page, /LIU DONG/);
  assert.match(css, /radial-gradient/);
  assert.match(css, /--yellow/);
  assert.match(css, /face-spike/);
  assert.match(css, /detail-hero/);
  assert.match(css, /profile-tabs/);
  assert.match(css, /about-hero/);
  assert.match(css, /brand-mini/);
  assert.match(css, /create-progress/);
  assert.match(css, /circle-draft-preview/);
  assert.match(readme, /当前状态：第一版可运行网页已发布/);
  assert.match(readme, /静态 Demo 还在吗/);
  assert.match(readme, /文档权威顺序/);
  assert.match(handoff, /版本 9 已发布/);
  assert.match(handoff, /匿名访问者可能共用同一身份/);
  assert.match(handoff, /只作为首次初始化的种子数据/);
  assert.match(handoff, /当前运行版/);
  assert.match(productDoc, /仅当事人.*不进入圈内公共动态/);
  assert.match(productDoc, /整体概念页/);
  assert.match(productDoc, /创建圈子页/);
  assert.match(dataDoc, /完整虚构好人卡/);
  assert.match(dataDoc, /静态策展层/);
  assert.match(designDoc, /FLOW CIRCLE/);
});

test("keeps local links in the developer handoff path valid", async () => {
  const documents = [
    new URL("../README.md", import.meta.url),
    new URL("../docs/开发交付说明.md", import.meta.url),
    new URL("../docs/产品需求文档：运营流程.md", import.meta.url),
    new URL("../docs/静态演示数据库.md", import.meta.url),
    new URL("../docs/静态演示设计系统.md", import.meta.url),
  ];

  for (const documentUrl of documents) {
    const markdown = await readFile(documentUrl, "utf8");
    const links = [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);

    for (const link of links) {
      if (/^(?:https?:|mailto:|#)/i.test(link)) continue;
      const [relativePath] = decodeURIComponent(link).split("#");
      await assert.doesNotReject(
        access(new URL(relativePath, documentUrl)),
        `Missing local link ${link} in ${documentUrl.pathname}`,
      );
    }
  }
});
