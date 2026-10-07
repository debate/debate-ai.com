-- Ranked ballots in the next-season topic-area poll on /practice/statistics.
-- The table is declared in apps/debate-ai.com/lib/database/schema.ts
-- (topicAreaRankings); one row per choice, up to five per user per season,
-- rank 1 being the first choice. Applied by .github/scripts/migrate-d1.ts,
-- which runs package migrations after the app's own.
CREATE TABLE IF NOT EXISTS `topic_area_rankings` (
	`season` integer NOT NULL,
	`user_id` text NOT NULL,
	`rank` integer NOT NULL,
	`area` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`season`, `user_id`, `rank`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `idx_topic_area_rankings_season` ON `topic_area_rankings` (`season`);
-- Single-choice votes cast before the poll became ranked carry over as each
-- voter's first choice. `topic_area_votes` itself is left in place, unread.
INSERT OR IGNORE INTO `topic_area_rankings` (`season`, `user_id`, `rank`, `area`, `created_at`)
	SELECT `season`, `user_id`, 1, `area`, `updated_at` FROM `topic_area_votes`;
