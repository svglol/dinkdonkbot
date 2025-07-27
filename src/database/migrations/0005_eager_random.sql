CREATE TABLE `kick-streams` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`broadcasterId` text NOT NULL,
	`guild` text NOT NULL,
	`channel` text NOT NULL,
	`roleId` text,
	`message` text DEFAULT '@everyone {{name}} is now live @ {{url}}',
	`offlineMessage` text DEFAULT '{{name}} is now offline'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kick_idIdx` ON `kick-streams` (`id`);--> statement-breakpoint
CREATE INDEX `kick_nameIdx` ON `kick-streams` (`name`);--> statement-breakpoint
CREATE INDEX `kick_broadcasterIdIdx` ON `kick-streams` (`broadcasterId`);--> statement-breakpoint
CREATE INDEX `kick_guildIdIdx` ON `kick-streams` (`guild`);