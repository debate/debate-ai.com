CREATE TABLE `youtube_video_exclusions` (
  `video_id` text PRIMARY KEY NOT NULL,
  `deleted_by` text,
  `deleted_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_youtube_video_exclusions_deleted_at` ON `youtube_video_exclusions` (`deleted_at`);
