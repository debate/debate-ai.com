CREATE TABLE `evidence_reuse_index` (
	`id` text PRIMARY KEY NOT NULL,
	`source_url` text NOT NULL,
	`normalized_url` text NOT NULL,
	`cite` text DEFAULT '' NOT NULL,
	`arg_block` text DEFAULT '' NOT NULL,
	`topic` text DEFAULT '' NOT NULL,
	`contributor_id` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_evidence_reuse_index_normalized_url` ON `evidence_reuse_index` (`normalized_url`);