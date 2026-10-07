-- Votes in the next-season topic-area poll on /practice/statistics. The table
-- is declared in apps/debate-ai.com/lib/database/schema.ts (topicAreaVotes);
-- one row per user per season, overwritten when the user changes their vote.
-- Applied by .github/scripts/migrate-d1.ts, which runs package migrations
-- after the app's own.
CREATE TABLE IF NOT EXISTS `topic_area_votes` (
	`season` integer NOT NULL,
	`user_id` text NOT NULL,
	`area` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`season`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
