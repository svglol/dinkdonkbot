CREATE TABLE `stream-messages` (
	`id` integer PRIMARY KEY NOT NULL,
	`streamId` integer,
	`kickStreamId` integer,
	`kickStreamStartedAt` integer,
	`twitchStreamStartedAt` integer,
	`kickStreamEndedAt` integer,
	`twitchStreamEndedAt` integer,
	`discordChannelId` text NOT NULL,
	`discordMessageId` text,
	`twitchStreamId` text,
	`twitchOnline` integer DEFAULT false,
	`kickOnline` integer DEFAULT false,
	`created_at` text DEFAULT (current_timestamp),
	`twitchStreamData` text,
	`twitchStreamerData` text,
	`twitchVod` text,
	`kickStreamData` text,
	`kickStreamerData` text,
	`kickVod` text,
	FOREIGN KEY (`streamId`) REFERENCES `streams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kickStreamId`) REFERENCES `kick-streams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `stream_messages_discord_channel_created_idx` ON `stream-messages` (`discordChannelId`,`created_at`);--> statement-breakpoint
CREATE INDEX `stream_messages_stream_created_idx` ON `stream-messages` (`streamId`,`created_at`);--> statement-breakpoint
CREATE INDEX `stream_messages_streamIdIdx` ON `stream-messages` (`streamId`);--> statement-breakpoint
CREATE INDEX `stream_messages_kickStreamIdIdx` ON `stream-messages` (`kickStreamId`);--> statement-breakpoint
CREATE INDEX `stream_messages_discordChannelId_idx` ON `stream-messages` (`discordChannelId`);--> statement-breakpoint
CREATE INDEX `stream_messages_createdAt_idx` ON `stream-messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `stream_messages_twitchOnline_idx` ON `stream-messages` (`twitchOnline`);--> statement-breakpoint
CREATE INDEX `stream_messages_kickOnline_idx` ON `stream-messages` (`kickOnline`);--> statement-breakpoint
DROP TABLE `kick-stream-messages`;--> statement-breakpoint
DROP TABLE `twitch-stream-messages`;