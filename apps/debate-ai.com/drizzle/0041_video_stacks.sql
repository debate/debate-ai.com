ALTER TABLE `videos` ADD `stack_key` text;--> statement-breakpoint
ALTER TABLE `videos` ADD `stack_position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_videos_stack_key` ON `videos` (`stack_key`);
