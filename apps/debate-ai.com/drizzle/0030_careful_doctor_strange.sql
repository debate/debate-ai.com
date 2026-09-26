CREATE TABLE `flow_presence_heartbeats` (
	`flow_id` integer NOT NULL,
	`author_id` text NOT NULL,
	`last_seen_at` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_flow_presence_heartbeats_flow_author` ON `flow_presence_heartbeats` (`flow_id`,`author_id`);--> statement-breakpoint
CREATE INDEX `idx_flow_presence_heartbeats_flow_id` ON `flow_presence_heartbeats` (`flow_id`);
