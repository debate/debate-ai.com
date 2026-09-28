CREATE TABLE `saved_counsel_panel_assessments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`round_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_saved_counsel_panel_assessments_user_id` ON `saved_counsel_panel_assessments` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_counsel_panel_assessments_user_client` ON `saved_counsel_panel_assessments` (`user_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `idx_saved_counsel_panel_assessments_round_id` ON `saved_counsel_panel_assessments` (`round_id`);