-- Collaboration relay: the Debate Editor's card sharing (Send / Receive pills)
-- and real-time co-editing, served by the app through the signed-in account
-- instead of the Debate Decoded relay. Rooms, their encrypted update logs and
-- snapshots, presence frames, and card mailboxes. The tables are declared in
-- apps/debate-web/lib/database/schema.ts (collabRelay*) and used by
-- apps/debate-web/lib/collab-relay. Applied by .github/scripts/migrate-d1.ts.
CREATE TABLE IF NOT EXISTS `collab_relay_rooms` (
	`room_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`guest_pass` text NOT NULL,
	`snapshot_covers` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `idx_collab_relay_rooms_owner` ON `collab_relay_rooms` (`owner_id`);
CREATE INDEX IF NOT EXISTS `idx_collab_relay_rooms_updated` ON `collab_relay_rooms` (`updated_at`);
CREATE TABLE IF NOT EXISTS `collab_relay_blobs` (
	`room_id` text NOT NULL,
	`kind` text NOT NULL,
	`seq` integer NOT NULL,
	`part` integer NOT NULL,
	`parts` integer NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`room_id`, `kind`, `seq`, `part`)
);
CREATE TABLE IF NOT EXISTS `collab_relay_presence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`from_sid` text DEFAULT '' NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `idx_collab_relay_presence_room` ON `collab_relay_presence` (`room_id`,`id`);
CREATE TABLE IF NOT EXISTS `collab_relay_mailboxes` (
	`recipient` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS `collab_relay_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`msg_id` text NOT NULL,
	`recipient` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`sender_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_collab_relay_messages_msg` ON `collab_relay_messages` (`msg_id`);
CREATE INDEX IF NOT EXISTS `idx_collab_relay_messages_recipient` ON `collab_relay_messages` (`recipient`,`id`);
