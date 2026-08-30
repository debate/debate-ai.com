CREATE TABLE `rounds` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text,
	`title` text DEFAULT 'Untitled Round' NOT NULL,
	`format` text,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_rounds_user_id` ON `rounds` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_rounds_updated_at` ON `rounds` (`updated_at`);--> statement-breakpoint
ALTER TABLE `user_settings` ADD `editor_preferences` text;