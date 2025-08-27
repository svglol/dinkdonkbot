PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_multistream` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`streamId` integer NOT NULL,
	`kickStreamId` integer NOT NULL,
	`priority` text DEFAULT 'twitch' NOT NULL,
	`lateMerge` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`streamId`) REFERENCES `streams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kickStreamId`) REFERENCES `kick-streams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_multistream`("id", "streamId", "kickStreamId", "priority", "lateMerge") SELECT "id", "streamId", "kickStreamId", "priority", "lateMerge" FROM `multistream`;--> statement-breakpoint
DROP TABLE `multistream`;--> statement-breakpoint
ALTER TABLE `__new_multistream` RENAME TO `multistream`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `multistream_idIdx` ON `multistream` (`id`);--> statement-breakpoint
CREATE INDEX `multistream_streamIdIdx` ON `multistream` (`streamId`);--> statement-breakpoint
CREATE INDEX `multistream_kickStreamIdIdx` ON `multistream` (`kickStreamId`);