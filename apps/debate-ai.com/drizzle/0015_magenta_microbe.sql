CREATE TABLE `saved_word_count_rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_saved_word_count_rounds_user_id` ON `saved_word_count_rounds` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_word_count_rounds_user_client` ON `saved_word_count_rounds` (`user_id`,`client_id`);