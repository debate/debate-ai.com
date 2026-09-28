CREATE TABLE `saved_daily_best_card_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`day_key` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_saved_daily_best_card_comments_user_id` ON `saved_daily_best_card_comments` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_daily_best_card_comments_user_client` ON `saved_daily_best_card_comments` (`user_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `idx_saved_daily_best_card_comments_day_key` ON `saved_daily_best_card_comments` (`day_key`);