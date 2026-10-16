-- Forum threads: the title and opening post a member writes, with the replies
-- stored as ordinary rows in `comments` keyed on this table's id
-- (`resource_type = 'thread'`) rather than in a second comment table. A forum
-- reply is therefore the same object as a reply under a video, and inherits
-- the nesting, the like toggle and the soft delete that table already has.
--
-- `last_activity_at` is the feed's sort key and is written on every reply, so
-- the forum's front page is an index walk rather than a sort over the whole
-- table. It is NOT NULL and defaults to the row's own creation second: a
-- thread nobody has replied to then sorts where a thread created at that
-- moment belongs — newest — instead of at whichever end of the index a NULL
-- lands on, which in SQLite is the very top of a DESC scan.
--
-- Ids are UUIDs minted by the API, like every other reader-facing id here, so
-- one thread's URL cannot be guessed from another's.
CREATE TABLE `forum_threads` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `body` text NOT NULL,
  `author_id` text NOT NULL,
  `deleted_at` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  `last_activity_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- The feed: one page of threads, most recently posted to first. `id` is in the
-- index for the tie-break — two threads posted in the same second have no
-- other order between them, and the cursor walk pages on this pair.
CREATE INDEX `idx_forum_threads_activity` ON `forum_threads` (`last_activity_at`,`id`);--> statement-breakpoint
-- "Threads I started", for a future profile page; the feed never reads it.
CREATE INDEX `idx_forum_threads_author` ON `forum_threads` (`author_id`,`created_at`);
