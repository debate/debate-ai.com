ALTER TABLE `documents` ADD `parent_id` integer;--> statement-breakpoint
ALTER TABLE `documents` ADD `is_folder` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_documents_parent_id` ON `documents` (`parent_id`);