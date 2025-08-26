CREATE TABLE `multistream` (
	`id` integer PRIMARY KEY NOT NULL,
	`streamId` integer NOT NULL,
	`kickStreamId` integer NOT NULL,
	`priority` text DEFAULT 'twitch' NOT NULL,
	FOREIGN KEY (`streamId`) REFERENCES `streams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kickStreamId`) REFERENCES `kick-streams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `multistream_idIdx` ON `multistream` (`id`);--> statement-breakpoint
CREATE INDEX `multistream_streamIdIdx` ON `multistream` (`streamId`);--> statement-breakpoint
CREATE INDEX `multistream_kickStreamIdIdx` ON `multistream` (`kickStreamId`);