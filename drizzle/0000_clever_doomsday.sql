CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`member_id` text NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`given` integer DEFAULT 0 NOT NULL,
	`received` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_circle_member_unique` ON `accounts` (`circle_id`,`member_id`);--> statement-breakpoint
CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`circle_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activities_source_unique` ON `activities` (`source`,`source_id`);--> statement-breakpoint
CREATE INDEX `activities_created_idx` ON `activities` (`created_at`);--> statement-breakpoint
CREATE TABLE `assistant_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`intent` text,
	`draft_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assistant_member_created_idx` ON `assistant_messages` (`member_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `circles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short` text NOT NULL,
	`color` text NOT NULL,
	`currency` text NOT NULL,
	`role` text NOT NULL,
	`location` text NOT NULL,
	`tagline` text NOT NULL,
	`intro` text NOT NULL,
	`scene` text NOT NULL,
	`joining` text NOT NULL,
	`invitation` text NOT NULL,
	`principles_json` text NOT NULL,
	`rules_json` text NOT NULL,
	`references_json` text NOT NULL,
	`settings_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `good_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`from_member_id` text NOT NULL,
	`to_member_id` text NOT NULL,
	`story` text NOT NULL,
	`tags_json` text NOT NULL,
	`visibility` text NOT NULL,
	`circle_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`from_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`created_by` text NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer NOT NULL,
	`max_uses` integer DEFAULT 1 NOT NULL,
	`used_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_hash_unique` ON `invitations` (`token_hash`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`circle_ids_json` text NOT NULL,
	`visibility` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`time` text DEFAULT '' NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`tags_json` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`nearby` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`name` text NOT NULL,
	`initial` text NOT NULL,
	`role` text NOT NULL,
	`color` text NOT NULL,
	`avatar` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`wechat` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_email_unique` ON `members` (`email`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`member_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_circle_member_unique` ON `memberships` (`circle_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `memberships_member_idx` ON `memberships` (`member_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`receiver_id` text NOT NULL,
	`amount` integer NOT NULL,
	`title` text NOT NULL,
	`story` text NOT NULL,
	`happened_at` integer NOT NULL,
	`recorded_at` integer NOT NULL,
	`visibility` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`tags_json` text NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receiver_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`member_id` text PRIMARY KEY NOT NULL,
	`public_cards` integer DEFAULT true NOT NULL,
	`public_listings` integer DEFAULT true NOT NULL,
	`keep_hidden_private` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
