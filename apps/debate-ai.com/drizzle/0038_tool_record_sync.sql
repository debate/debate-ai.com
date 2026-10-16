CREATE TABLE `saved_tool_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`collection` text NOT NULL,
	`client_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_saved_tool_records_user_collection` ON `saved_tool_records` (`user_id`,`collection`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_tool_records_user_collection_client` ON `saved_tool_records` (`user_id`,`collection`,`client_id`);
