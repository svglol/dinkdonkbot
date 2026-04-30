PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_birthday-config` (
	`guildId` text PRIMARY KEY NOT NULL,
	`overviewChannelId` text,
	`overviewMessageId` text,
	`announcementChannelId` text,
	`announcementMessage` text,
	`birthdayRoleId` text,
	`pingRoleId` text,
	`timezone` text
);
--> statement-breakpoint
INSERT INTO `__new_birthday-config`("guildId", "overviewChannelId", "overviewMessageId", "announcementChannelId", "announcementMessage", "birthdayRoleId", "pingRoleId", "timezone") SELECT "guildId", "overviewChannelId", "overviewMessageId", "announcementChannelId", "announcementMessage", "birthdayRoleId", "pingRoleId", "timezone" FROM `birthday-config`;--> statement-breakpoint
DROP TABLE `birthday-config`;--> statement-breakpoint
ALTER TABLE `__new_birthday-config` RENAME TO `birthday-config`;--> statement-breakpoint
PRAGMA foreign_keys=ON;