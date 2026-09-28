CREATE TABLE `debate_cards` (
	`id` integer PRIMARY KEY NOT NULL,
	`tag` text DEFAULT '' NOT NULL,
	`cite` text DEFAULT '' NOT NULL,
	`fullcite` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`spoken` text DEFAULT '' NOT NULL,
	`fulltext` text DEFAULT '' NOT NULL,
	`text_length` integer DEFAULT 0 NOT NULL,
	`markup` text DEFAULT '' NOT NULL,
	`pocket` text DEFAULT '' NOT NULL,
	`hat` text DEFAULT '' NOT NULL,
	`block` text DEFAULT '' NOT NULL,
	`bucket_id` integer DEFAULT 0 NOT NULL,
	`duplicate_count` integer DEFAULT 0 NOT NULL,
	`side` text DEFAULT '' NOT NULL,
	`caselist_display_name` text DEFAULT '' NOT NULL,
	`year` integer DEFAULT 0 NOT NULL,
	`event` text DEFAULT '' NOT NULL,
	`level` text DEFAULT '' NOT NULL,
	`source_file` text DEFAULT '' NOT NULL,
	`imported_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_debate_cards_year` ON `debate_cards` (`year`);--> statement-breakpoint
CREATE INDEX `idx_debate_cards_event` ON `debate_cards` (`event`);--> statement-breakpoint
CREATE INDEX `idx_debate_cards_level` ON `debate_cards` (`level`);--> statement-breakpoint
CREATE INDEX `idx_debate_cards_side` ON `debate_cards` (`side`);--> statement-breakpoint
CREATE INDEX `idx_debate_cards_caselist` ON `debate_cards` (`caselist_display_name`);--> statement-breakpoint
CREATE INDEX `idx_debate_cards_bucket` ON `debate_cards` (`bucket_id`);--> statement-breakpoint
CREATE INDEX `idx_debate_cards_source_file` ON `debate_cards` (`source_file`);--> statement-breakpoint
CREATE TABLE `debate_card_imports` (
	`file_name` text PRIMARY KEY NOT NULL,
	`rows_imported` integer DEFAULT 0 NOT NULL,
	`rows_skipped` integer DEFAULT 0 NOT NULL,
	`last_import_id` text DEFAULT '' NOT NULL,
	`last_imported_by` text DEFAULT '' NOT NULL,
	`first_imported_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_imported_at` integer DEFAULT (unixepoch()) NOT NULL
);
