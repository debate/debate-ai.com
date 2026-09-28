-- Source URL debate-card-parser extracts from each card's citation. Filled on
-- import and by the admin panel's "Extract source URLs" backfill; the URL
-- recheck reads it rather than re-parsing every cite.
ALTER TABLE `debate_cards` ADD `source_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_debate_cards_source_url` ON `debate_cards` (`source_url`);
