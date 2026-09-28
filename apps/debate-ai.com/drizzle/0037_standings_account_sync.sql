ALTER TABLE `user_settings` ADD `qualification_points_table` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `qualification_cutoff` text;--> statement-breakpoint
CREATE TABLE `saved_tournament_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_saved_tournament_results_user_id` ON `saved_tournament_results` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_tournament_results_user_client` ON `saved_tournament_results` (`user_id`,`client_id`);
