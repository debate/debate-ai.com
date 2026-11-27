-- Reader-suggested card text for References entries whose quote is missing or
-- only ellipses (apps/debate-web/lib/reference-suggestions/store.ts). Mirrors
-- `referenceTextSuggestions` in apps/debate-web/lib/database/schema.ts.
CREATE TABLE IF NOT EXISTS `reference_text_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`page` text NOT NULL,
	`ref_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`text` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`user_id` text,
	`ip_hash` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`resolved_by` text,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_reference_text_suggestions_ref` ON `reference_text_suggestions` (`page`,`ref_id`,`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_reference_text_suggestions_status` ON `reference_text_suggestions` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_reference_text_suggestions_ip` ON `reference_text_suggestions` (`ip_hash`,`created_at`);
