CREATE TABLE `page_reuse_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_url` text NOT NULL,
	`source_url` text NOT NULL,
	`cite` text DEFAULT '' NOT NULL,
	`arg_block` text DEFAULT '' NOT NULL,
	`contributor_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_page_reuse_entries_normalized_url` ON `page_reuse_entries` (`normalized_url`);