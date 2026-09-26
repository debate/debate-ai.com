CREATE TABLE `video_transcripts` (
	`video_id` text NOT NULL,
	`lang` text DEFAULT 'en' NOT NULL,
	`snippets` text NOT NULL,
	`fetched_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`video_id`, `lang`)
);
