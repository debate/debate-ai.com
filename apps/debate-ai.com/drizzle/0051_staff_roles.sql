CREATE TABLE `staff_roles` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'moderator' NOT NULL,
	`invited_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
