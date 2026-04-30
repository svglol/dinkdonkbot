ALTER TABLE `birthday` ADD `disabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `birthday-config` ADD `disabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `birthday-config` DROP COLUMN `announcementMessage`;--> statement-breakpoint
ALTER TABLE `birthday-config` DROP COLUMN `pingRoleId`;