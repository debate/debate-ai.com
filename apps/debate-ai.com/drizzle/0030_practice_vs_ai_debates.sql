CREATE TABLE IF NOT EXISTS `practice_vs_ai_debates` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `email` text DEFAULT '' NOT NULL,
  `bot_name` text DEFAULT '' NOT NULL,
  `topic` text DEFAULT '' NOT NULL,
  `outcome` text DEFAULT '' NOT NULL,
  `result` text DEFAULT 'pending' NOT NULL,
  `data` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_practice_vs_ai_debates_user_id` ON `practice_vs_ai_debates` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_practice_vs_ai_debates_user_created` ON `practice_vs_ai_debates` (`user_id`,`created_at`);
