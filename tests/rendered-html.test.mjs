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
  const [loop, runtime, bootstrap, records, profile, testAuth, testLogin] = await Promise.all([
    readFile(new URL("../app/lib/loop.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/runtime.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/bootstrap/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/records/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/local-test-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/test-login/route.ts", import.meta.url), "utf8"),
  ]);

  // Sessions live in httpOnly cookies, never in the client bundle.
  assert.match(loop, /LOOP_API_BASE/);
  assert.match(loop, /runtimeEnv/);
  assert.match(loop, /loopApiBase/);
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
  assert.match(profile, /avatar/);
  // Local test auth can only use real backend-issued tokens and only against a
  // local backend; it must never become a production identity bypass.
  assert.match(testAuth, /LOCAL_TEST_AUTH/);
  assert.match(testAuth, /localhost/);
  assert.match(testAuth, /127\.0\.0\.1/);
  assert.match(testLogin, /sessionCookies/);
  assert.match(testLogin, /loop-backend/);
});

test("no AI assistant is wired up", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(page, /api\/assistant/);
  assert.doesNotMatch(page, /BUBBLE_ASSISTANT/);
  await assert.rejects(readFile(new URL("../app/api/assistant/draft/route.ts", import.meta.url), "utf8"));
});

test("keeps the confirmed product flows and visual language in source", async () => {
  const [page, types, css, readme, faceAvatar, abstractAvatar] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../app/components/face-avatar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/abstract-avatar.tsx", import.meta.url), "utf8"),
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
  assert.match(page, /QRCode/);
  assert.match(page, /profile=/);
  assert.match(page, /listing\.visibility === "cross-circle"/);
  assert.doesNotMatch(page, /仅包含跨圈公开内容/);
  assert.match(page, /复制链接/);
  assert.match(page, /PostShareSheet/);
  assert.match(page, /post=/);
  assert.match(page, /仅圈内成员可见/);
  assert.match(page, /onShare\(post\.id\)/);
  assert.match(page, /isLocalUrl/);
  assert.match(page, /仅这台电脑可打开/);
  assert.match(page, /character-mark/);
  // Corrections are proposed, then resolved by the other party.
  assert.match(page, /提议更正/);
  assert.match(page, /resolveCorrection/);
  assert.match(page, /TransactionDialog/);
  assert.match(page, /发送更正提议/);
  assert.match(page, /记录已撤销，请核对双方额度/);
  assert.doesNotMatch(page, /记录已撤销，双方额度已经恢复/);
  assert.doesNotMatch(page, /window\.prompt/);
  assert.doesNotMatch(page, /window\.confirm/);
  assert.doesNotMatch(page, /确认拒绝或撤销这笔记录/);
  assert.match(page, /Number\.isInteger\(amt\)/);
  assert.doesNotMatch(page, /Math\.trunc\(Number\(amount\)\)/);
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

  // ── membership has a way out, and applicants can see they're waiting ──
  // A pending applicant used to get circles:[] and no explanation, while the
  // discover page kept offering the circle they'd already applied to.
  assert.match(page, /pendingCircles/);
  assert.match(page, /withdrawRequest/);
  assert.match(page, /等圈主放行|等圈主确认/);
  assert.match(page, /撤回申请/);
  // Leaving is promised on the invite page; it must exist, and say why not.
  assert.match(page, /leaveCircle/);
  assert.match(page, /transferOwner/);
  assert.match(page, /退出圈子/);
  assert.match(page, /转让圈主/);
  assert.match(page, /确认转让圈主/);
  assert.match(page, /确认退出圈子/);
  // Notifications: loop writes them, the client renders the copy.
  assert.match(page, /NotificationsSheet/);
  assert.match(page, /markNotificationsRead/);
  assert.match(page, /stillWaiting/);
  assert.match(page, /notification-action/);
  assert.match(page, /这次入圈申请已经处理/);
  assert.match(page, /这笔记录已经处理，不需要再确认/);
  assert.match(types, /Notification/);
  // Visual identity: circles are stored as two-character theme keys and
  // rendered as pictograms; the brand and notification controls use custom
  // SVGs instead of initials or platform emoji.
  assert.match(page, /type CircleIconKey/);
  assert.match(page, /CIRCLE_ICON_GROUPS/);
  assert.match(page, /function CircleGlyph/);
  assert.match(page, /function BrandGlyph/);
  assert.match(page, /function NotificationIcon/);
  assert.match(page, /选择圈子图案/);
  assert.doesNotMatch(page, /🔔/);
  assert.doesNotMatch(page, />流<\/span>/);

  // ── regression guards for bugs found walking the live site ──
  // The feed is derived from `db`; leaving it out of the deps froze the feed
  // after every mutation while the toast claimed success.
  assert.match(page, /\}\), \[db, feedFilter, feedCircleId\]\)/);
  assert.match(page, /\}\), \[db, discoverFilter\]\)/);
  // An unresolved id must not borrow a real person's name.
  assert.match(page, /UNKNOWN_MEMBER/);
  assert.doesNotMatch(page, /members\.find\(\(member\) => member\.id === id\) \?\? members\[0\]/);
  // Post ids survive a refetch (the activity array is re-indexed each load).
  assert.match(page, /const postId = `\$\{activity\.source\}:\$\{activity\.sourceId\}`/);
  // Only the counterparty may confirm — loop 403s the record's own creator.
  assert.match(page, /transaction\.createdById !== activeDb\.currentMemberId/);
  // Paused/closed listings leave the feed.
  assert.match(page, /listing\.status !== "active"/);
  // A backend outage is not a logout.
  assert.match(page, /loadFailed/);
  // Reopening the create wizard after a success must start a blank form, not
  // strand you on the previous success screen.
  assert.match(page, /key=\{createSession\}/);
  assert.match(page, /setCreateSession/);
  // Each step blocks incomplete fields before people can reach the final save.
  assert.match(page, /canEnterStep/);
  assert.match(page, /圈子约定最多 10 条/);
  assert.match(page, /协商参考需要同时填写名称和额度/);
  // A write that succeeded must never be reported as a failure just because
  // the follow-up refetch failed — that is what makes people retry, and on the
  // composer path a retry writes a second ledger entry.
  assert.match(page, /async function syncAfterWrite/);
  assert.doesNotMatch(page, /await refreshData\(\);\n\s*flash\(/);
  // Invite links are single-use, so each copy mints a fresh one.
  assert.doesNotMatch(page, /inviteUrl\|\|await createInvite/);
  // QR previews must encode real share URLs; a decorative grid is not a QR code.
  assert.match(page, /QrCode value=\{inviteUrl\}/);
  assert.match(css, /grid-template-columns: auto minmax\(0,1fr\) auto auto/);
  // Approve/decline can't be double-tapped into two requests.
  assert.match(page, /disabled=\{busy\}/);
  // Sheets opened from inside another sheet return there.
  assert.match(page, /openSubSheet/);
  // Background tabs refresh when a person returns, without permanent polling.
  assert.match(page, /visibilitychange/);
  assert.match(page, /window\.addEventListener\("focus"/);
  assert.doesNotMatch(page, /setInterval\([^)]*refresh/);
  // Long names stay visible in the mobile header instead of being ellipsized.
  assert.match(css, /\.topbar h1 \{[^}]*white-space: normal/);
  // Empty filters, incomplete metadata and self-profile actions stay legible.
  assert.match(page, /暂时没有动态/);
  assert.match(page, /timeAndPlace/);
  assert.match(page, /onEditProfile/);
  // Modal escape and editable reference lists avoid browser-native dead ends.
  assert.match(page, /event\.key !== "Escape"/);
  assert.match(page, /removeReference/);
  assert.match(page, /互助额度名称不能为空/);
  assert.match(css, /\.feed-empty/);
  // Share posters can be saved as real PNG files with their QR code intact.
  assert.match(page, /savePosterImage/);
  assert.match(page, /toPng/);
  assert.equal((page.match(/>保存图片</g) ?? []).length, 3);
  // New accounts keep one of eight stable geometry marks; profile editing can
  // save a real, composable face without replacing the backend identity.
  assert.doesNotMatch(page, /注册后默认使用系统几何图案，你也可以换一个/);
  assert.match(page, /定制我的脸/);
  assert.match(page, /ABSTRACT_AVATARS\.map/);
  assert.match(page, /AbstractAvatarArtwork/);
  assert.doesNotMatch(page, /ABSTRACT_AVATAR_LABELS/);
  assert.match(page, /aria-label=\{`系统几何图案 \$\{index \+ 1\}`\}/);
  assert.match(page, /aria-label=\{label\} title=\{label\}/);
  assert.doesNotMatch(page, /<small>\{label\}<\/small>/);
  assert.match(abstractAvatar, /variant === "crop"/);
  assert.match(abstractAvatar, /variant === "wave"/);
  assert.match(abstractAvatar, /variant === "leaf"/);
  assert.match(abstractAvatar, /#e9877b/);
  assert.match(abstractAvatar, /#7fa6d7/);
  assert.match(abstractAvatar, /#acd0a6/);
  assert.match(abstractAvatar, /<circle cx="24" cy="24" r="23" \{\.\.\.outline\}/);
  assert.match(abstractAvatar, /<clipPath id=\{clipId\}><circle cx="24" cy="24" r="23"\/><\/clipPath>/);
  assert.match(abstractAvatar, /clipPath=\{`url\(#\$\{clipId\}\)`\}/);
  assert.match(css, /\.abstract-avatar-artwork \{ position: absolute; inset: 0; width: 100%; height: 100%/);
  assert.match(css, /\.character\.avatar-abstract \{ border: 0;/);
  assert.match(css, /\.avatar-visual-choice \.character \{ width: 58px; height: 58px/);
  assert.match(page, /换一套搭配/);
  assert.match(page, /CURATED_FACE_PRESETS/);
  assert.match(page, /\['hair','发型'\]/);
  assert.doesNotMatch(page, /推荐搭配/);
  assert.match(page, /AVATAR_HAIRS\.map/);
  assert.match(page, /AVATAR_EYES\.map/);
  assert.match(page, /AVATAR_GLASSES\.map/);
  assert.match(page, /AVATAR_MOUTHS\.map/);
  assert.doesNotMatch(page, /AVATAR_ACCESSORIES\.map/);
  assert.doesNotMatch(page, /右下角标记/);
  assert.match(page, /FaceAvatarArtwork/);
  assert.match(css, /\.custom-avatar-artwork/);
  assert.match(css, /\.avatar-visual-choice/);
  assert.match(css, /\.avatar-part-tabs/);
  assert.match(faceAvatar, /gold: "#efca72"/);
  assert.doesNotMatch(faceAvatar, /AccessoryArtwork/);
  assert.match(faceAvatar, /case "fringe"/);
  assert.doesNotMatch(faceAvatar, /accessory === "sparkle"/);
  assert.match(faceAvatar, /function BackHairLayer/);
  assert.match(faceAvatar, /function FrontHairLayer/);
  assert.match(faceAvatar, /const common = \{ fill: color \}/);
  assert.match(faceAvatar, /<clipPath id=\{faceClipId\}>/);
  assert.match(faceAvatar, /clipPath=\{`url\(#\$\{faceClipId\}\)`\}/);
  assert.doesNotMatch(faceAvatar, /non-scaling-stroke/);
  assert.match(faceAvatar, /hair === "longWave"/);
  assert.match(faceAvatar, /hair === "ponytail"/);
  assert.match(faceAvatar, /hair === "halfUp"/);
  assert.match(faceAvatar, /hair === "twinTail"/);
  assert.match(faceAvatar, /viewBox="0 0 100 100"/);
  assert.doesNotMatch(faceAvatar, /viewBox="-8 -8 116 116"/);
  assert.doesNotMatch(css, /\.custom-avatar-badge/);
  // Both requested record entry points open the same composer; nav items share one icon frame.
  assert.match(page, /<ComposeHero onCompose=\{onCompose\}/);
  assert.match(page, /className="compose-slot"/);
  assert.match(page, /kind === "record" && <path d="M12 7\.5v9M7\.5 12h9"/);
  assert.match(css, /grid-template-columns: repeat\(5, minmax\(0,1fr\)\)/);
  assert.match(css, /\.bottom-nav > button\.active \.nav-icon \{ background: transparent; border-color: transparent; \}/);
  assert.match(css, /\.circle-switcher::-webkit-scrollbar \{ display: none; \}/);
  assert.match(page, /className=\{`dock-all[^\n]+<NavIcon kind="feed"/);
  assert.match(css, /\.new-circle b::before,\.new-circle b::after/);
  assert.match(css, /drop-shadow\(1px 1px 0 rgba\(25,25,25,\.28\)\)/);
  assert.match(css, /\.topbar \.avatar-button \.character \{ box-shadow: 1px 1px 0 rgba\(25,25,25,\.24\); \}/);
  assert.match(css, /\.bell-button:hover \{ transform: translate\(-1px,-1px\); box-shadow: 2px 2px 0 rgba\(25,25,25,\.32\); \}/);
  // Every modal opens with the same compact title structure; removed copy
  // must not reappear as a second explanatory layer.
  assert.match(page, /function SheetHeading/);
  assert.equal((page.match(/<Modal/g) ?? []).length, (page.match(/<SheetHeading/g) ?? []).length);
  assert.doesNotMatch(page, /<div className="sheet-heading"/);
  assert.doesNotMatch(page, /发布确认|发布前确认|公开边界|给出增加，收到减少/);
  // No seeded demo identities remain.
  assert.doesNotMatch(page, /"qiao"|"ashu"|"village"|"human"/);
  // The refreshed visual language keeps the four colors with softer surfaces.
  assert.match(css, /--line: 1\.5px/);
  assert.match(css, /--shadow: 0 12px 30px rgba/);
  assert.match(readme, /loop-backend/);
});
