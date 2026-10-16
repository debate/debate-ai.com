-- File market: wallets, the wallet ledger, files for sale and purchases. The
-- same tables are declared in apps/debate-ai.com/lib/database/schema.ts
-- (wallets, walletTransactions, fileListings, filePurchases);
-- apps/debate-ai.com/lib/market/__tests__/queries.test.ts checks the two stay
-- in step. Applied by .github/scripts/migrate-d1.ts, which runs package
-- migrations after the app's own.
CREATE TABLE IF NOT EXISTS `file_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`seller_id` text NOT NULL,
	`document_id` integer,
	`title` text NOT NULL,
	`outline` text DEFAULT '[]' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`format` text DEFAULT 'html' NOT NULL,
	`price_cents` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sales` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE set null
);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_file_listings_document` ON `file_listings` (`document_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_file_listings_active` ON `file_listings` (`active`,`updated_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_file_listings_seller` ON `file_listings` (`seller_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `file_purchases` (
	`listing_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`price_cents` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`listing_id`, `buyer_id`),
	FOREIGN KEY (`listing_id`) REFERENCES `file_listings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`buyer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_file_purchases_buyer` ON `file_purchases` (`buyer_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `wallet_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`ref` text NOT NULL,
	`listing_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_wallet_transactions_ref` ON `wallet_transactions` (`ref`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_wallet_transactions_user` ON `wallet_transactions` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `wallets` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance_cents` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

