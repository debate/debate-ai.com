CREATE TABLE `reuse_check_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`normalized_url` text NOT NULL,
	`already_cut` integer NOT NULL,
	`match_count` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	`checked_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reuse_check_log_normalized_url` ON `reuse_check_log` (`normalized_url`);--> statement-breakpoint
CREATE INDEX `idx_reuse_check_log_already_cut` ON `reuse_check_log` (`already_cut`);