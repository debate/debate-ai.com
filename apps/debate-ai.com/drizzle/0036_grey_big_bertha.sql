CREATE TABLE `card_ai_analyses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`card_hash` text NOT NULL,
	`prompt_hash` text NOT NULL,
	`card_tag` text,
	`result` text NOT NULL,
	`model` text,
	`user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_card_ai_analyses_card_prompt` ON `card_ai_analyses` (`card_hash`,`prompt_hash`);--> statement-breakpoint
CREATE TABLE `card_shares` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`room_id` text NOT NULL,
	`share_code` text NOT NULL,
	`guest_pass` text,
	`title` text DEFAULT '' NOT NULL,
	`message` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`opened_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_card_shares_owner` ON `card_shares` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_card_shares_recipient` ON `card_shares` (`recipient_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_card_shares_room_recipient` ON `card_shares` (`room_id`,`recipient_id`);--> statement-breakpoint
CREATE TABLE `caselist_documents` (
	`id` integer PRIMARY KEY NOT NULL,
	`path_hash` text NOT NULL,
	`caselist_slug` text NOT NULL,
	`caselist_label` text NOT NULL,
	`school` text NOT NULL,
	`team` text,
	`side` text,
	`file_name` text NOT NULL,
	`archive_path` text NOT NULL,
	`html` text NOT NULL,
	`card_count` integer DEFAULT 0 NOT NULL,
	`ingested_at` integer DEFAULT (unixepoch()) NOT NULL,
	`archive_date` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `caselist_documents_path_hash_unique` ON `caselist_documents` (`path_hash`);--> statement-breakpoint
CREATE INDEX `idx_caselist_documents_school` ON `caselist_documents` (`school`);--> statement-breakpoint
CREATE INDEX `idx_caselist_documents_team` ON `caselist_documents` (`team`);--> statement-breakpoint
CREATE INDEX `idx_caselist_documents_caselist_slug` ON `caselist_documents` (`caselist_slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_caselist_documents_path_hash` ON `caselist_documents` (`path_hash`);--> statement-breakpoint
CREATE TABLE `comment_likes` (
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`comment_id`, `user_id`),
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comment_likes_comment` ON `comment_likes` (`comment_id`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`parent_id` text,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comments_resource` ON `comments` (`resource_type`,`resource_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_comments_parent` ON `comments` (`parent_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`requester_id` text NOT NULL,
	`addressee_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`requester_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`addressee_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contacts_pair` ON `contacts` (`requester_id`,`addressee_id`);--> statement-breakpoint
CREATE INDEX `idx_contacts_addressee` ON `contacts` (`addressee_id`);--> statement-breakpoint
CREATE TABLE `debate_card_imports` (
	`file_name` text PRIMARY KEY NOT NULL,
	`rows_imported` integer DEFAULT 0 NOT NULL,
	`rows_skipped` integer DEFAULT 0 NOT NULL,
	`last_import_id` text DEFAULT '' NOT NULL,
	`last_imported_by` text DEFAULT '' NOT NULL,
	`first_imported_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_imported_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
-- `debate_cards` (and its base indexes) is created by 0035_debate_cards.sql;
-- `source_url` and its index are added later by
-- 0054_debate_card_source_url.sql. This file used to redeclare both,
-- duplicating 0035's table. On replay that redeclaration no-opped (the
-- create became `IF NOT EXISTS` against a table 0035 already created),
-- but the `source_url` index right after it still ran against that same
-- table — which has no such column until 0054 — so applying migrations in
-- order failed here with "no such column: source_url" every time.
CREATE TABLE `saved_learn_cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_saved_learn_cards_user_id` ON `saved_learn_cards` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_learn_cards_user_client` ON `saved_learn_cards` (`user_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `saved_learn_decks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_saved_learn_decks_user_id` ON `saved_learn_decks` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_learn_decks_user_client` ON `saved_learn_decks` (`user_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `saved_learn_review_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_saved_learn_review_log_user_id` ON `saved_learn_review_log` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_learn_review_log_user_client` ON `saved_learn_review_log` (`user_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `saved_quick_cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_saved_quick_cards_user_id` ON `saved_quick_cards` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_quick_cards_user_client` ON `saved_quick_cards` (`user_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `saved_tool_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`collection` text NOT NULL,
	`client_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_saved_tool_records_user_collection` ON `saved_tool_records` (`user_id`,`collection`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_tool_records_user_collection_client` ON `saved_tool_records` (`user_id`,`collection`,`client_id`);--> statement-breakpoint
CREATE TABLE `saved_tournament_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_saved_tournament_results_user_id` ON `saved_tournament_results` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_tournament_results_user_client` ON `saved_tournament_results` (`user_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `staff_roles` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'moderator' NOT NULL,
	`invited_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stripe_subscriptions` (
	`subscription_id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`customer_id` text,
	`email` text,
	`price_id` text,
	`plan` text,
	`status` text,
	`current_period_end` integer,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_stripe_subscriptions_user` ON `stripe_subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_stripe_subscriptions_customer` ON `stripe_subscriptions` (`customer_id`);--> statement-breakpoint
CREATE TABLE `user_blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`blocker_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`blocker_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_blocks_pair` ON `user_blocks` (`blocker_id`,`blocked_id`);--> statement-breakpoint
CREATE INDEX `idx_user_blocks_blocked` ON `user_blocks` (`blocked_id`);--> statement-breakpoint
CREATE TABLE `user_presence` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `video_documents` (
	`video_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text,
	`body` text DEFAULT '' NOT NULL,
	`author` text DEFAULT 'editor' NOT NULL,
	`model` text,
	`word_count` integer DEFAULT 0 NOT NULL,
	`updated_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`video_id`, `kind`)
);
--> statement-breakpoint
CREATE TABLE `video_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'other' NOT NULL,
	`issue` text DEFAULT '' NOT NULL,
	`suggested_style` integer,
	`suggested_category` text,
	`suggested_round_level` text,
	`reported_by` text,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_by` text,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_video_issues_video` ON `video_issues` (`video_id`);--> statement-breakpoint
CREATE INDEX `idx_video_issues_status` ON `video_issues` (`status`);--> statement-breakpoint
CREATE TABLE `video_relations` (
	`video_id` text NOT NULL,
	`related_video_id` text NOT NULL,
	`relation` text DEFAULT 'analysis' NOT NULL,
	`note` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`video_id`, `related_video_id`, `relation`)
);
--> statement-breakpoint
CREATE INDEX `idx_video_relations_related` ON `video_relations` (`related_video_id`);--> statement-breakpoint
CREATE TABLE `video_transcripts` (
	`video_id` text NOT NULL,
	`lang` text DEFAULT 'en' NOT NULL,
	`snippets` text NOT NULL,
	`fetched_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`video_id`, `lang`)
);
--> statement-breakpoint
CREATE TABLE `youtube_channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel_id` text,
	`name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`added_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_youtube_channels_name` ON `youtube_channels` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_youtube_channels_channel_id` ON `youtube_channels` (`channel_id`);--> statement-breakpoint
ALTER TABLE `documents` ADD `format` text DEFAULT 'html' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `previous_slug` text;--> statement-breakpoint
ALTER TABLE `topic_starter_items` ADD `format` text DEFAULT 'html' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `recent_tools` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `qualification_points_table` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `qualification_cutoff` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `brainstorm_session_timer` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `practice_vs_ai_score` integer;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `practice_vs_ai_badges` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `practice_vs_ai_last_played_day_key` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `practice_vs_ai_current_streak` integer;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `my_team_profile` text;--> statement-breakpoint
ALTER TABLE `videos` ADD `stack_key` text;--> statement-breakpoint
ALTER TABLE `videos` ADD `stack_position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `videos` ADD `availability` text DEFAULT 'available' NOT NULL;--> statement-breakpoint
ALTER TABLE `videos` ADD `availability_checked_at` integer;--> statement-breakpoint
ALTER TABLE `videos` ADD `missing_checks` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `videos` ADD `view_count_synced_at` integer;--> statement-breakpoint
ALTER TABLE `videos` ADD `admin_edited` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_videos_availability` ON `videos` (`availability`);--> statement-breakpoint
CREATE INDEX `idx_videos_stack_key` ON `videos` (`stack_key`);