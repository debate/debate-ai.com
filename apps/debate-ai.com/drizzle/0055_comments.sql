-- Threaded comments, polymorphic over (resource_type, resource_id) so one
-- table and one API serve discussions on videos, files, lectures and card
-- contributions alike. `parent_id` is the adjacency list that makes a reply a
-- reply, with ON DELETE CASCADE so a removed account takes its comments and
-- its likes with it; comments are never hard-deleted, only stamped with
-- `deleted_at`, so a deleted post leaves its replies standing.
--
-- Ids are UUIDs minted by the API rather than autoincrement rowids: a counting
-- id leaks the size of a discussion to a reader who has not scrolled it yet and
-- makes comment URLs guessable from one another.
CREATE TABLE `comments` (
  `id` text PRIMARY KEY NOT NULL,
  `resource_type` text NOT NULL,
  `resource_id` text NOT NULL,
  `parent_id` text,
  `author_id` text NOT NULL,
  `body` text NOT NULL,
  `deleted_at` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- A thread read: every comment on one resource, oldest first. `resource_type`
-- leads so a `resource_id` reused across kinds (a short slug, say) cannot pull
-- in another kind's thread.
CREATE INDEX `idx_comments_resource` ON `comments` (`resource_type`,`resource_id`,`created_at`);--> statement-breakpoint
-- The per-parent read, for when a thread's replies are fetched on their own.
CREATE INDEX `idx_comments_parent` ON `comments` (`parent_id`,`created_at`);--> statement-breakpoint
-- One like per person per comment, enforced by the composite key: the toggle
-- endpoint can then never double-count a second click, and the count behind a
-- like button is an indexed COUNT rather than a read-modify-write of a counter
-- column that two concurrent likes can disagree about.
CREATE TABLE `comment_likes` (
  `comment_id` text NOT NULL,
  `user_id` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  PRIMARY KEY(`comment_id`, `user_id`),
  FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comment_likes_comment` ON `comment_likes` (`comment_id`);
