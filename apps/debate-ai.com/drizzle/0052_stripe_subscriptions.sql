CREATE TABLE `stripe_subscriptions` (
	`subscription_id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`customer_id` text,
	`email` text,
	`price_id` text,
	`plan` text,
	`status` text,
	`current_period_end` integer,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_stripe_subscriptions_user` ON `stripe_subscriptions` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_stripe_subscriptions_customer` ON `stripe_subscriptions` (`customer_id`);
