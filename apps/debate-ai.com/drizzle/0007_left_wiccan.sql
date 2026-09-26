CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`debate_style` integer,
	`font_size` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
