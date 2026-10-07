-- Who follows which team or school profile (/teams/[team], /schools/[school]).
-- The table is declared in apps/debate-ai.com/lib/database/schema.ts
-- (profileFollows); one row per user per followed profile, so following twice
-- is a no-op and the follower count is a plain count of rows. Applied by
-- .github/scripts/migrate-d1.ts, which runs package migrations after the app's
-- own.
CREATE TABLE IF NOT EXISTS `profile_follows` (
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `kind`, `slug`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `idx_profile_follows_target` ON `profile_follows` (`kind`, `slug`);
