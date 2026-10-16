CREATE TABLE `detected_urls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`url` text NOT NULL,
	`normalized_url` text NOT NULL,
	`title` text,
	`favicon` text,
	`visit_count` integer DEFAULT 1 NOT NULL,
	`last_visited_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_detected_urls_user_id` ON `detected_urls` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_detected_urls_normalized_url` ON `detected_urls` (`normalized_url`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_detected_urls_user_url` ON `detected_urls` (`user_id`,`normalized_url`);--> statement-breakpoint
CREATE INDEX `idx_detected_urls_last_visited` ON `detected_urls` (`last_visited_at`);--> statement-breakpoint
CREATE TABLE `forum_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`author_id` text NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_activity_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_forum_threads_activity` ON `forum_threads` (`last_activity_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_forum_threads_author` ON `forum_threads` (`author_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `practice_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`challenger_id` text NOT NULL,
	`opponent_id` text NOT NULL,
	`judge_id` text,
	`judge_status` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`format` text NOT NULL,
	`topic` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`proposed_at` integer,
	`room_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`challenger_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opponent_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`judge_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_practice_challenges_challenger` ON `practice_challenges` (`challenger_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_practice_challenges_opponent` ON `practice_challenges` (`opponent_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_practice_challenges_judge` ON `practice_challenges` (`judge_id`);--> statement-breakpoint
CREATE INDEX `idx_practice_challenges_open` ON `practice_challenges` (`status`,`judge_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `practice_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`as_competitor` integer DEFAULT false NOT NULL,
	`as_judge` integer DEFAULT false NOT NULL,
	`preferences` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_practice_profiles_updated` ON `practice_profiles` (`updated_at`);