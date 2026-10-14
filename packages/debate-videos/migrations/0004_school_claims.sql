-- School ownership: claims to coach or run a school's program, the school
-- page's own data (name and logo), and the roster of teams and students an
-- owner lists. Declared in apps/debate-ai.com/lib/database/schema.ts
-- (schoolProfiles, schoolClaims, schoolMembers). Applied by
-- .github/scripts/migrate-d1.ts, which runs package migrations after the app's
-- own.
CREATE TABLE IF NOT EXISTS `school_profiles` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`logo` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE TABLE IF NOT EXISTS `school_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`school_slug` text NOT NULL,
	`school_name` text NOT NULL,
	`is_new_school` integer DEFAULT false NOT NULL,
	`role` text NOT NULL,
	`school_email` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`code_hash` text,
	`code_expires_at` integer,
	`code_attempts` integer DEFAULT 0 NOT NULL,
	`explanation` text,
	`status` text NOT NULL,
	`reviewed_by` text,
	`review_note` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `idx_school_claims_user` ON `school_claims` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_school_claims_school` ON `school_claims` (`school_slug`, `status`);
CREATE INDEX IF NOT EXISTS `idx_school_claims_status` ON `school_claims` (`status`);
CREATE TABLE IF NOT EXISTS `school_members` (
	`id` text PRIMARY KEY NOT NULL,
	`school_slug` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`added_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`added_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX IF NOT EXISTS `idx_school_members_school` ON `school_members` (`school_slug`, `kind`);
