CREATE TABLE `youtube_round_videos` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`published_at` text NOT NULL,
	`channel` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`style` integer NOT NULL,
	`tournament` text,
	`round_level` text,
	`aff` text,
	`neg` text,
	`winner` integer,
	`judge_decision` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_youtube_round_videos_published_at` ON `youtube_round_videos` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_youtube_round_videos_channel` ON `youtube_round_videos` (`channel`);--> statement-breakpoint
CREATE INDEX `idx_youtube_round_videos_style` ON `youtube_round_videos` (`style`);--> statement-breakpoint
CREATE TABLE `youtube_sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`triggered_by` text,
	`channels_synced` integer DEFAULT 0 NOT NULL,
	`videos_fetched` integer DEFAULT 0 NOT NULL,
	`videos_upserted` integer DEFAULT 0 NOT NULL,
	`error` text,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_youtube_sync_runs_started_at` ON `youtube_sync_runs` (`started_at`);