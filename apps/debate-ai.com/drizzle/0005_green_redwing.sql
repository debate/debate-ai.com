CREATE TABLE `videos` (
	`video_id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`published_at` text DEFAULT '' NOT NULL,
	`published_ms` integer DEFAULT 0 NOT NULL,
	`channel` text DEFAULT '' NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`style` integer,
	`category` text,
	`category_key` text,
	`tournament` text,
	`round_level` text,
	`aff_team` text,
	`neg_team` text,
	`aff_win` integer,
	`judge_decision` text,
	`arg_1ac` text,
	`arg_2nr` text,
	`is_top_pick` integer DEFAULT false NOT NULL,
	`speech_docs_url` text,
	`season_year` integer DEFAULT 0 NOT NULL,
	`search_text` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_videos_published_ms` ON `videos` (`published_ms`);--> statement-breakpoint
CREATE INDEX `idx_videos_view_count` ON `videos` (`view_count`);--> statement-breakpoint
CREATE INDEX `idx_videos_style` ON `videos` (`style`);--> statement-breakpoint
CREATE INDEX `idx_videos_season_year` ON `videos` (`season_year`);--> statement-breakpoint
CREATE INDEX `idx_videos_category_key` ON `videos` (`category_key`);--> statement-breakpoint
CREATE INDEX `idx_videos_source` ON `videos` (`source`);--> statement-breakpoint
CREATE INDEX `idx_videos_is_top_pick` ON `videos` (`is_top_pick`);