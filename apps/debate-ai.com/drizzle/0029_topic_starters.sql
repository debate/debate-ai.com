CREATE TABLE `topic_starter_items` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` text NOT NULL,
  `content` text DEFAULT '' NOT NULL,
  `parent_id` integer,
  `is_folder` integer DEFAULT false NOT NULL,
  `tags` text DEFAULT '[]' NOT NULL,
  `published` integer DEFAULT true NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_topic_starter_items_parent_id` ON `topic_starter_items` (`parent_id`);
--> statement-breakpoint
CREATE INDEX `idx_topic_starter_items_published` ON `topic_starter_items` (`published`);
