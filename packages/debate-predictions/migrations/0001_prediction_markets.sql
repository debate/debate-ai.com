-- Prediction markets: wallets, markets and bets. The same tables are declared
-- in apps/debate-ai.com/lib/database/schema.ts (predictionWallets,
-- predictionMarkets, predictionBets);
-- apps/debate-ai.com/lib/predictions/__tests__/queries.test.ts checks the two
-- stay in step. Applied by .github/scripts/migrate-d1.ts, which runs package
-- migrations after the app's own.
CREATE TABLE IF NOT EXISTS `prediction_wallets` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance` integer NOT NULL,
	`granted_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_prediction_wallets_balance` ON `prediction_wallets` (`balance`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `prediction_markets` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`creator_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`outcomes` text NOT NULL,
	`shares` text NOT NULL,
	`liquidity` real NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`volume` integer DEFAULT 0 NOT NULL,
	`source` text NOT NULL,
	`closes_at` integer NOT NULL,
	`resolved_outcome` text,
	`resolved_at` integer,
	`resolution_note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_prediction_markets_status` ON `prediction_markets` (`status`,`closes_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_prediction_markets_creator` ON `prediction_markets` (`creator_id`,`status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `prediction_bets` (
	`id` text PRIMARY KEY NOT NULL,
	`market_id` text NOT NULL,
	`user_id` text NOT NULL,
	`outcome_id` text NOT NULL,
	`stake` integer NOT NULL,
	`shares` real NOT NULL,
	`payout` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`market_id`) REFERENCES `prediction_markets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_prediction_bets_market` ON `prediction_bets` (`market_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_prediction_bets_user` ON `prediction_bets` (`user_id`,`created_at`);
