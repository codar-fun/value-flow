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
test("partner avatars roundtrip current combinations and reject retired shapes and versions", () => {
  for (const shape of Object.keys(PARTNER_SHAPES)) for (const expression of Object.keys(PARTNER_EXPRESSIONS)) for (const color of Object.keys(PARTNER_COLORS)) {
    const config = { shape, expression, color };
    const value = encodePartnerAvatar(config);
    assert.deepEqual(parsePartnerAvatar(value), config);
    assert.equal(isAvatarVariant(value), true);
  }
  for (const value of ["custom:cream:short:none:smile:star", "custom2:cream:round:short:ink:wink:none:smile:none"]) assert.equal(isAvatarVariant(value), true);
  for (const value of ["leaf", "buddy1:retired:smile", "buddy1:retired:smile:star:extra", "buddy2:retired:smile:coral", "buddy3:retired:smile:coral:-", null]) assert.equal(isAvatarVariant(value), false);
  for (const value of [null, "buddy1:retired:smile", "buddy2:retired:smile:coral", "buddy3:retired:smile:coral:-"]) assert.equal(parsePartnerAvatar(value), null);
});
test("random partners stay valid and change their appearance", () => {
  let previous = { shape: "crop", expression: "smile", color: "blue" };
  for (let i = 0; i < 100; i++) {
    const next = parsePartnerAvatar(randomPartnerAvatar(previous));
    assert.ok(next);
    assert.notEqual(next.shape, previous.shape);
    previous = next;
  }
});

test("bootstrap preserves partner combinations for the viewer and other members", () => {
  const avatar = encodePartnerAvatar({ shape: "cap", expression: "cheeky", color: "coral" });
  const user = { ...account(ME, "a"), avatar };
  const other = { ...account(OTHER, "b"), avatar: encodePartnerAvatar({ shape: "monster", expression: "happy", color: "blue", accentColor: "coral" }) };
  const db = toAppDatabase(bootstrap({ user, members: [user, other] }));
  assert.equal(db.members.find(member => member.id === ME).avatar, avatar);
  assert.equal(db.members.find(member => member.id === OTHER).avatar, other.avatar);
});

test("retired partner avatar versions are no longer parsed", () => {
  for (const avatar of ["buddy1:cap:wink:flower", "buddy2:bear:happy:lavender", "buddy3:retired:happy:lavender:-"])
    assert.equal(parsePartnerAvatar(avatar), null);
});

test("revisions, discoverability, totals and opening balances map through", () => {
  const db = toAppDatabase(
    bootstrap({
      circles: [
        { ...bootstrap().circles[0], discoverability: "public", stats: { posted_records: 7, mystery_records: 2 } },
        { ...bootstrap().circles[0], id: "circle-2", discoverability: "something-new" },
      ],
      circle_accounts: [{ circle_id: CIRCLE, account_id: ME, balance: 310, given: 10, received: 0, opening_balance: 300 }],
      records: [
        record("r1", "confirmed", {
          version: 3,
          pending_revision: {
            id: "v1", revision_id: "v1", kind: "revoke", base_version: 3, old_values: { amount: 4 }, new_values: {},
            proposed_by_id: OTHER, status: "pending", resolved_by_id: null, created_at: "2026-10-07T00:00:00Z", resolved_at: null,
          },
        }),
      ],
    }),
  );

  const [publicCircle, otherCircle] = db.circles;
  assert.equal(publicCircle.discoverability, "public");
  assert.deepEqual(publicCircle.stats, { posted: 7, mystery: 2 });
  // an unrecognised value is never treated as public
  assert.equal(otherCircle.discoverability, "unknown");
  assert.equal(otherCircle.stats, null);

  assert.equal(db.accounts[0].openingBalance, 300);
  const [t] = db.transactions;
  assert.equal(t.version, 3);
  assert.equal(t.pendingRevision.kind, "revoke");
  assert.equal(t.pendingRevision.proposedById, OTHER);
});

test("gender survives bootstrap for other members and remains absent for legacy accounts", () => {
  for (const gender of ["male", "female", null]) {
    const db = toAppDatabase(bootstrap({ members: [{ ...account(OTHER, "b"), gender }] }));
    assert.equal(db.members.find(m => m.id === OTHER).gender, gender);
  }
  assert.equal(toAppDatabase(bootstrap()).members.find(m => m.id === ME).gender, null);
});
