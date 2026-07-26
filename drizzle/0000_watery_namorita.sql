CREATE TABLE `food_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`portion` text NOT NULL,
	`emoji` text DEFAULT 'meal' NOT NULL,
	`calories` integer NOT NULL,
	`protein_g` integer NOT NULL,
	`carbs_g` integer NOT NULL,
	`fat_g` integer NOT NULL,
	`sugar_g` integer DEFAULT 0 NOT NULL,
	`fiber_g` integer DEFAULT 0 NOT NULL,
	`sodium_mg` integer DEFAULT 0 NOT NULL,
	`usage_count` integer DEFAULT 1 NOT NULL,
	`last_used_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `food_templates_owner_name_unique` ON `food_templates` (`owner_id`,`name`);--> statement-breakpoint
CREATE INDEX `food_templates_owner_usage_idx` ON `food_templates` (`owner_id`,`usage_count`);
