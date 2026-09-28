CREATE TABLE `saved_coach_material_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`material_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_saved_coach_material_versions_user_id` ON `saved_coach_material_versions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_coach_material_versions_user_client` ON `saved_coach_material_versions` (`user_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `idx_saved_coach_material_versions_material_id` ON `saved_coach_material_versions` (`material_id`);--> statement-breakpoint
CREATE TABLE `saved_coach_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_saved_coach_materials_user_id` ON `saved_coach_materials` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_coach_materials_user_client` ON `saved_coach_materials` (`user_id`,`client_id`);