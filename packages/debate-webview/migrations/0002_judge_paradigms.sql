-- Judge paradigms: the cache of Tabroom judges' paradigms and judging records
-- (filled when a judge is clicked in pairings and by the admin sync), the
-- sync's progress, and the paradigms judges write on this site. The tables
-- are declared in apps/debate-web/lib/database/schema.ts (judgeParadigms,
-- judgeParadigmSync, judgeOwnParadigms). Applied by .github/scripts/migrate-d1.ts.
CREATE TABLE IF NOT EXISTS `judge_paradigms` (
	`person_id` integer PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`first` text DEFAULT '' NOT NULL,
	`last` text DEFAULT '' NOT NULL,
	`paradigm_html` text,
	`last_reviewed` text,
	`record` text DEFAULT '[]' NOT NULL,
	`rounds` integer DEFAULT 0 NOT NULL,
	`certifications` text DEFAULT '[]' NOT NULL,
	`source` text DEFAULT 'tabroom-api' NOT NULL,
	`status` text DEFAULT 'ok' NOT NULL,
	`error` text,
	`synced_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX IF NOT EXISTS `idx_judge_paradigms_name` ON `judge_paradigms` (`last`,`first`);
CREATE INDEX IF NOT EXISTS `idx_judge_paradigms_synced` ON `judge_paradigms` (`synced_at`);
CREATE TABLE IF NOT EXISTS `judge_paradigm_sync` (
	`id` text PRIMARY KEY NOT NULL,
	`discovery_offset` integer DEFAULT 0 NOT NULL,
	`discovery_done` integer DEFAULT false NOT NULL,
	`last_run_at` integer,
	`last_error` text
);
CREATE TABLE IF NOT EXISTS `judge_own_paradigms` (
	`user_id` text PRIMARY KEY NOT NULL,
	`tabroom_person_id` integer,
	`verified` integer DEFAULT false NOT NULL,
	`verify_code` text NOT NULL,
	`markdown` text DEFAULT '' NOT NULL,
	`html` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `idx_judge_own_paradigms_person` ON `judge_own_paradigms` (`tabroom_person_id`,`verified`);
