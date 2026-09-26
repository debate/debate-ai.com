CREATE TABLE `card_shares` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`room_id` text NOT NULL,
	`share_code` text NOT NULL,
	`guest_pass` text,
	`title` text DEFAULT '' NOT NULL,
	`message` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`opened_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_card_shares_owner` ON `card_shares` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_card_shares_recipient` ON `card_shares` (`recipient_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_card_shares_room_recipient` ON `card_shares` (`room_id`,`recipient_id`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`requester_id` text NOT NULL,
	`addressee_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`requester_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`addressee_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contacts_pair` ON `contacts` (`requester_id`,`addressee_id`);--> statement-breakpoint
CREATE INDEX `idx_contacts_addressee` ON `contacts` (`addressee_id`);--> statement-breakpoint
CREATE TABLE `user_blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`blocker_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`blocker_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_blocks_pair` ON `user_blocks` (`blocker_id`,`blocked_id`);--> statement-breakpoint
CREATE INDEX `idx_user_blocks_blocked` ON `user_blocks` (`blocked_id`);--> statement-breakpoint
CREATE TABLE `user_presence` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
