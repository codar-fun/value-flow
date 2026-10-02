// Behaviour tests for how a /bootstrap payload becomes the app's world
// (db/runtime.ts). They run the real mapping on hand-built payloads in the
// shape flow-backend returns; they say nothing about whether the backend
// actually sends that shape.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// db/runtime.ts imports "../app/lib/avatar" the bundler way, without an
// extension; Node's resolver needs it spelled out.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error?.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".")) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const { toAppDatabase } = await import(new URL("../db/runtime.ts", import.meta.url).href);

const ME = "member-a";
const OTHER = "member-b";
const CIRCLE = "circle-1";

function account(id, name) {
  return { id, username: name, display_name: name, handle: `@${name}`, avatar: null, bio: null, address: null, wechat_contact: null };
}

function record(id, status, extra = {}) {
  return {
    id,
    circle_id: CIRCLE,
    provider_id: ME,
    receiver_id: OTHER,
    created_by_id: ME,
    amount: 4,
    title: `记录 ${id}`,
    story: "",
    visibility: "public",
    status,
    tags: [],
    pending_correction: null,
    happened_at: null,
    recorded_at: "2026-10-01T00:00:00Z",
    redacted: false,
    ...extra,
  };
}

function bootstrap(overrides = {}) {
  return {
    current_member_id: ME,
    user: account(ME, "a"),
    settings: { public_cards: true, public_listings: true, keep_hidden_private: true },
    circles: [
      {
        id: CIRCLE,
        name: "互助圈",
        icon: "✨",
        color: "#7ec99a",
        description: null,
        currency: "泡泡",
        joining: "direct",
        owner_id: ME,
        is_member: true,
        member_ids: [ME, OTHER],
        member_count: 2,
        settings: {},
      },
    ],
    members: [account(ME, "a"), account(OTHER, "b")],
    circle_accounts: [],
    records: [],
    listings: [],
    good_cards: [],
    join_requests: [],
    pending_circles: [],
    notifications: [],
    unread_notifications: 0,
    ...overrides,
  };
}

test("a withdrawn record stays in the parties' records but never reaches the feed", () => {
  const db = toAppDatabase(bootstrap({ records: [record("kept", "confirmed"), record("gone", "rejected")] }));

  assert.deepEqual(db.transactions.map((t) => [t.id, t.status]), [["kept", "confirmed"], ["gone", "rejected"]]);
  assert.deepEqual(
    db.activity.filter((a) => a.source === "transaction").map((a) => a.sourceId),
    ["kept"],
  );
});

test("record notifications carry the record they are about", () => {
  const db = toAppDatabase(
    bootstrap({
      records: [record("r1", "pending")],
      notifications: [
        { id: "n1", kind: "record_confirmation_requested", actor_id: OTHER, amount: 4, note: null, circle_id: CIRCLE, record_id: "r1", text: null, read: false, created_at: "2026-10-01T00:00:00Z" },
        // older rows predate record_id and must still map
        { id: "n2", kind: "invite", actor_id: OTHER, amount: 4, note: null, circle_id: CIRCLE, text: null, read: false, created_at: "2026-09-01T00:00:00Z" },
      ],
    }),
  );

  assert.equal(db.notifications.find((n) => n.id === "n1").recordId, "r1");
  assert.equal(db.notifications.find((n) => n.id === "n2").recordId, "");
});

const { PARTNER_SHAPES, PARTNER_EXPRESSIONS, PARTNER_COLORS, encodePartnerAvatar, parsePartnerAvatar, randomPartnerAvatar } = await import("../app/lib/partner-avatar.ts");
const { isAvatarVariant } = await import("../app/lib/avatar.ts");
test("partner avatars roundtrip every independent combination and retain legacy avatars", () => {
  for (const shape of Object.keys(PARTNER_SHAPES)) for (const expression of Object.keys(PARTNER_EXPRESSIONS)) for (const color of Object.keys(PARTNER_COLORS)) {
    const config = { shape, expression, color };
    const value = encodePartnerAvatar(config);
    assert.deepEqual(parsePartnerAvatar(value), config);
    assert.equal(isAvatarVariant(value), true);
  }
  for (const value of ["leaf", "custom:cream:short:none:smile:star", "custom2:cream:round:short:ink:wink:none:smile:none"]) assert.equal(isAvatarVariant(value), true);
  for (const value of [null, "buddy1:cat:smile", "buddy1:cat:smile:star:extra", "buddy1:cat:nope:star", "buddy1:__proto__:smile:none", "buddy1:cat:smile:constructor"]) assert.equal(parsePartnerAvatar(value), null);
});
test("random partners stay valid and change their appearance", () => {
  let previous = { shape: "cat", expression: "smile", color: "blue" };
  for (let i = 0; i < 100; i++) {
    const next = parsePartnerAvatar(randomPartnerAvatar(previous));
    assert.ok(next);
    assert.notEqual(next.shape, previous.shape);
    previous = next;
  }
});

test("bootstrap preserves partner combinations for the viewer and other members", () => {
  const avatar = "buddy1:cap:wink:flower";
  const user = { ...account(ME, "a"), avatar };
  const other = { ...account(OTHER, "b"), avatar: "buddy1:cat:happy:leaf" };
  const db = toAppDatabase(bootstrap({ user, members: [user, other] }));
  assert.equal(db.members.find(member => member.id === ME).avatar, avatar);
  assert.equal(db.members.find(member => member.id === OTHER).avatar, other.avatar);
});

test("old sticker avatars keep their shape and expression without retaining stickers", () => {
  assert.deepEqual(parsePartnerAvatar("buddy1:cat:wink:flower"), { shape: "cat", expression: "wink", color: "coral" });
  assert.equal(parsePartnerAvatar("buddy2:cat:wink:flower"), null);
  assert.equal(parsePartnerAvatar("buddy2:cat:wink:__proto__"), null);
  const avatar = "buddy2:octopus:happy:lavender";
  const user = { ...account(ME, "a"), avatar };
  assert.equal(toAppDatabase(bootstrap({ user, members: [user] })).members[0].avatar, avatar);
});
