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
