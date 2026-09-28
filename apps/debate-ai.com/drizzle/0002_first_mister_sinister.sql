CREATE TABLE `flow_sync_edits` (
	`id` text PRIMARY KEY NOT NULL,
	`flow_id` integer NOT NULL,
	`box_path` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`timestamp_ms` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_flow_sync_edits_flow_id` ON `flow_sync_edits` (`flow_id`);