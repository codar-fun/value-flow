import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  email: text("email").unique(),
  name: text("name").notNull(),
  initial: text("initial").notNull(),
  role: text("role").notNull(),
  color: text("color").notNull(),
  avatar: text("avatar").notNull(),
  bio: text("bio").notNull().default(""),
  wechat: text("wechat").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const circles = sqliteTable("circles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  short: text("short").notNull(),
  color: text("color").notNull(),
  currency: text("currency").notNull(),
  role: text("role").notNull(),
  location: text("location").notNull(),
  tagline: text("tagline").notNull(),
  intro: text("intro").notNull(),
  scene: text("scene").notNull(),
  joining: text("joining").notNull(),
  invitation: text("invitation").notNull(),
  principlesJson: text("principles_json").notNull(),
  rulesJson: text("rules_json").notNull(),
  referencesJson: text("references_json").notNull(),
  settingsJson: text("settings_json").notNull(),
  createdBy: text("created_by").notNull().references(() => members.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const memberships = sqliteTable("memberships", {
  id: text("id").primaryKey(),
  circleId: text("circle_id").notNull().references(() => circles.id),
  memberId: text("member_id").notNull().references(() => members.id),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("active"),
  joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("memberships_circle_member_unique").on(table.circleId, table.memberId),
  index("memberships_member_idx").on(table.memberId),
]);

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  circleId: text("circle_id").notNull().references(() => circles.id),
  memberId: text("member_id").notNull().references(() => members.id),
  balance: integer("balance").notNull().default(0),
  given: integer("given").notNull().default(0),
  received: integer("received").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("accounts_circle_member_unique").on(table.circleId, table.memberId)]);

export const listings = sqliteTable("listings", {
  id: text("id").primaryKey(), memberId: text("member_id").notNull().references(() => members.id),
  type: text("type").notNull(), title: text("title").notNull(), detail: text("detail").notNull(),
  circleIdsJson: text("circle_ids_json").notNull(), visibility: text("visibility").notNull(),
  location: text("location").notNull().default(""), time: text("time").notNull().default(""),
  reference: text("reference").notNull().default(""), tagsJson: text("tags_json").notNull(),
  status: text("status").notNull().default("active"), nearby: integer("nearby", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const goodCards = sqliteTable("good_cards", {
  id: text("id").primaryKey(), fromMemberId: text("from_member_id").notNull().references(() => members.id),
  toMemberId: text("to_member_id").notNull().references(() => members.id), story: text("story").notNull(),
  tagsJson: text("tags_json").notNull(), visibility: text("visibility").notNull(),
  circleId: text("circle_id").notNull().references(() => circles.id), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(), circleId: text("circle_id").notNull().references(() => circles.id),
  providerId: text("provider_id").notNull().references(() => members.id), receiverId: text("receiver_id").notNull().references(() => members.id),
  amount: integer("amount").notNull(), title: text("title").notNull(), story: text("story").notNull(),
  happenedAt: integer("happened_at", { mode: "timestamp_ms" }).notNull(), recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
  visibility: text("visibility").notNull(), status: text("status").notNull().default("confirmed"), tagsJson: text("tags_json").notNull(),
});

export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement: true }), source: text("source").notNull(),
  sourceId: text("source_id").notNull(), circleId: text("circle_id").notNull().references(() => circles.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("activities_source_unique").on(table.source, table.sourceId), index("activities_created_idx").on(table.createdAt)]);

export const invitations = sqliteTable("invitations", {
  id: text("id").primaryKey(), circleId: text("circle_id").notNull().references(() => circles.id),
  createdBy: text("created_by").notNull().references(() => members.id), tokenHash: text("token_hash").notNull().unique(),
  status: text("status").notNull().default("active"), expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  maxUses: integer("max_uses").notNull().default(1), usedCount: integer("used_count").notNull().default(0), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const userSettings = sqliteTable("user_settings", {
  memberId: text("member_id").primaryKey().references(() => members.id),
  publicCards: integer("public_cards", { mode: "boolean" }).notNull().default(true),
  publicListings: integer("public_listings", { mode: "boolean" }).notNull().default(true),
  keepHiddenPrivate: integer("keep_hidden_private", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const assistantMessages = sqliteTable("assistant_messages", {
  id: text("id").primaryKey(), memberId: text("member_id").notNull().references(() => members.id),
  role: text("role").notNull(), content: text("content").notNull(), intent: text("intent"),
  draftJson: text("draft_json"), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("assistant_member_created_idx").on(table.memberId, table.createdAt)]);

export const dataMigrations = sqliteTable("data_migrations", {
  id: text("id").primaryKey(),
  appliedAt: integer("applied_at", { mode: "timestamp_ms" }).notNull(),
});
