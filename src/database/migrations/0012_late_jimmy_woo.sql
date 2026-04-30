CREATE TABLE `birthday` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guildId` text NOT NULL,
	`userId` text NOT NULL,
	`day` integer NOT NULL,
	`month` integer NOT NULL,
	`year` integer,
	`timezone` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `birthday_idIdx` ON `birthday` (`id`);--> statement-breakpoint
CREATE INDEX `birthday_userIdIdx` ON `birthday` (`userId`);--> statement-breakpoint
CREATE INDEX `birthday_guildIdIdx` ON `birthday` (`guildId`);--> statement-breakpoint
CREATE TABLE `birthday-config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guildId` text NOT NULL,
	`overviewChannelId` text,
	`overviewMessageId` text,
	`announcementChannelId` text,
	`announcementMessage` text,
	`birthdayRoleId` text,
	`pingRoleId` text,
	`timezone` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `birthday-config_guildId_unique` ON `birthday-config` (`guildId`);--> statement-breakpoint
CREATE UNIQUE INDEX `birthday_config_idIdx` ON `birthday-config` (`id`);--> statement-breakpoint
CREATE INDEX `birthday_config_guildIdIdx` ON `birthday-config` (`guildId`);