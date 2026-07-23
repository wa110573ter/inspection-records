CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`record_id` text,
	`owner_email` text NOT NULL,
	`category` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`record_id`) REFERENCES `case_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attachments_object_key_unique` ON `attachments` (`object_key`);--> statement-breakpoint
CREATE INDEX `attachments_case_idx` ON `attachments` (`case_id`);--> statement-breakpoint
CREATE INDEX `attachments_record_idx` ON `attachments` (`record_id`);--> statement-breakpoint
CREATE INDEX `attachments_owner_idx` ON `attachments` (`owner_email`);--> statement-breakpoint
CREATE TABLE `case_records` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`date` text NOT NULL,
	`method` text NOT NULL,
	`pointer` text DEFAULT '' NOT NULL,
	`process` text DEFAULT '' NOT NULL,
	`result` text DEFAULT '' NOT NULL,
	`next_step` text DEFAULT '' NOT NULL,
	`follow_up_date` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `records_case_date_idx` ON `case_records` (`case_id`,`date`);--> statement-breakpoint
CREATE INDEX `records_owner_idx` ON `case_records` (`owner_email`);--> statement-breakpoint
CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`water_number` text NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`coordinates` text DEFAULT '' NOT NULL,
	`meter_number` text DEFAULT '' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`received_date` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '待處理' NOT NULL,
	`custom_status` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cases_owner_updated_idx` ON `cases` (`owner_email`,`updated_at`);--> statement-breakpoint
CREATE INDEX `cases_owner_water_idx` ON `cases` (`owner_email`,`water_number`);