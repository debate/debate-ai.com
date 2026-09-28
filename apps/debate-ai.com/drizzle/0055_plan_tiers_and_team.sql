-- Plan tiers (lib/stripe/limits.ts): per-day usage counts, plus the Research
-- Team plan's student roster and the lesson plans / practice drills a coach
-- assigns to it.
CREATE TABLE `usage_counters` (
	`subject` text NOT NULL,
	`metric` text NOT NULL,
	`day` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`subject`, `metric`, `day`)
);
--> statement-breakpoint
CREATE TABLE `team_students` (
	`owner_user_id` text NOT NULL,
	`student_email` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`owner_user_id`, `student_email`),
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_team_students_email` ON `team_students` (`student_email`);
--> statement-breakpoint
CREATE TABLE `team_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`student_emails` text,
	`due_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_team_assignments_owner` ON `team_assignments` (`owner_user_id`);
