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
ALTER TABLE `videos` ADD `availability` text DEFAULT 'available' NOT NULL;--> statement-breakpoint
ALTER TABLE `videos` ADD `availability_checked_at` integer;--> statement-breakpoint
ALTER TABLE `videos` ADD `missing_checks` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `videos` ADD `view_count_synced_at` integer;--> statement-breakpoint
CREATE INDEX `idx_videos_availability` ON `videos` (`availability`);
