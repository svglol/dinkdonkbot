CREATE TABLE `kick-stream-messages` (
	`id` integer PRIMARY KEY NOT NULL,
	`broadcasterId` text NOT NULL,
	`streamStartedAt` text NOT NULL,
	`kickStreamId` integer NOT NULL,
	`discordChannelId` text NOT NULL,
	`discordMessageId` text NOT NULL,
	`embedData` blob,
	`created_at` text DEFAULT (current_timestamp),
	FOREIGN KEY (`kickStreamId`) REFERENCES `kick-streams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kick_messages_idIdx` ON `kick-stream-messages` (`id`);--> statement-breakpoint
CREATE INDEX `kick_messages_broadcasterIdIdx` ON `kick-stream-messages` (`broadcasterId`);--> statement-breakpoint
CREATE INDEX `kick_messages_streamStartedAtIdx` ON `kick-stream-messages` (`streamStartedAt`);--> statement-breakpoint
CREATE INDEX `kick_messages_kickStreamIdIdx` ON `kick-stream-messages` (`kickStreamId`);--> statement-breakpoint
CREATE INDEX `kick_messages_discordChannelIdIdx` ON `kick-stream-messages` (`discordChannelId`);--> statement-breakpoint
CREATE UNIQUE INDEX `kick_messages_uniqueIdx` ON `kick-stream-messages` (`broadcasterId`,`streamStartedAt`,`kickStreamId`);--> statement-breakpoint
CREATE TABLE `twitch-stream-messages` (
	`id` integer PRIMARY KEY NOT NULL,
	`broadcasterId` text NOT NULL,
	`streamStartedAt` text NOT NULL,
	`streamId` integer NOT NULL,
	`discordChannelId` text NOT NULL,
	`discordMessageId` text NOT NULL,
	`twitchStreamId` text NOT NULL,
	`embedData` blob,
	`created_at` text DEFAULT (current_timestamp),
	FOREIGN KEY (`streamId`) REFERENCES `streams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `twitch_messages_idIdx` ON `twitch-stream-messages` (`id`);--> statement-breakpoint
CREATE INDEX `twitch_messages_broadcasterIdIdx` ON `twitch-stream-messages` (`broadcasterId`);--> statement-breakpoint
CREATE INDEX `twitch_messages_streamIdIdx` ON `twitch-stream-messages` (`streamId`);--> statement-breakpoint
CREATE INDEX `twitch_messages_discordChannelIdIdx` ON `twitch-stream-messages` (`discordChannelId`);--> statement-breakpoint
CREATE UNIQUE INDEX `twitch_messages_uniqueIdx` ON `twitch-stream-messages` (`broadcasterId`,`streamStartedAt`,`streamId`);