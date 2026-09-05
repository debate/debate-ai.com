ALTER TABLE `topic_starter_items` ADD `owner_id` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `topic_starter_items` ADD `source_document_id` integer;--> statement-breakpoint
CREATE INDEX `idx_topic_starter_items_owner_id` ON `topic_starter_items` (`owner_id`);