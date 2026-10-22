-- The watch page's shared AI results: detected speech starts, speech
-- summaries and Outcomes runs, saved once per video and served to every
-- viewer. Declared in apps/debate-web/lib/database/schema.ts
-- (videoAiResults). Applied by .github/scripts/migrate-d1.ts, which runs
-- package migrations after the app's own.
CREATE TABLE IF NOT EXISTS `video_ai_results` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`kind` text NOT NULL,
	`item_key` text DEFAULT '' NOT NULL,
	`data` text NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX IF NOT EXISTS `idx_video_ai_results_video` ON `video_ai_results` (`video_id`);
