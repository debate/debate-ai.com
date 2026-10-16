CREATE TABLE `card_ai_analyses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`card_hash` text NOT NULL,
	`prompt_hash` text NOT NULL,
	`card_tag` text,
	`result` text NOT NULL,
	`model` text,
	`user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_card_ai_analyses_card_prompt` ON `card_ai_analyses` (`card_hash`,`prompt_hash`);
