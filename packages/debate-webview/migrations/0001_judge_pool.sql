-- Judge Pool: judges offering to be hired for circuit-calendar weekends, and
-- the hire requests tournament organizers send them. The tables are declared
-- in apps/debate-ai.com/lib/database/schema.ts (judgePoolListings,
-- judgeHireRequests). Applied by .github/scripts/migrate-d1.ts, which runs
-- package migrations after the app's own.
CREATE TABLE IF NOT EXISTS `judge_pool_listings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`weekends` text DEFAULT '[]' NOT NULL,
	`states` text DEFAULT '[]' NOT NULL,
	`can_travel` integer DEFAULT false NOT NULL,
	`formats` text DEFAULT '[]' NOT NULL,
	`philosophy` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `idx_judge_pool_listings_active` ON `judge_pool_listings` (`active`,`updated_at`);
CREATE TABLE IF NOT EXISTS `judge_hire_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`organizer_id` text NOT NULL,
	`judge_id` text NOT NULL,
	`tournament_name` text NOT NULL,
	`weekend` text NOT NULL,
	`offer` text DEFAULT '' NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`judge_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `idx_judge_hire_requests_organizer` ON `judge_hire_requests` (`organizer_id`,`status`);
CREATE INDEX IF NOT EXISTS `idx_judge_hire_requests_judge` ON `judge_hire_requests` (`judge_id`,`status`);
