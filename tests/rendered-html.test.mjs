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

test("renders the community currency demo shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /流动圈｜社区互助静态 Demo/);
  assert.match(html, /我的圈子动态/);
  assert.match(html, /泡泡助手/);
  assert.match(html, /说一句/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("keeps the confirmed product flows and visual language in source", async () => {
  const [page, data, css, readme, dataDoc, designDoc] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/demo-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
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
  assert.match(readme, /三个实例，不是三个产品/);
  assert.match(dataDoc, /完整虚构好人卡/);
  assert.match(designDoc, /FLOW CIRCLE/);
});
