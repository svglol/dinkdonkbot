CREATE TABLE `clips` (
	`id` integer PRIMARY KEY NOT NULL,
	`streamer` text NOT NULL,
	`broadcasterId` text NOT NULL,
	`guild` text NOT NULL,
	`channel` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clipsidIdx` ON `clips` (`id`);--> statement-breakpoint
CREATE INDEX `clipsStreamerIdx` ON `clips` (`streamer`);--> statement-breakpoint
CREATE INDEX `clipsBroadcasterIdx` ON `clips` (`broadcasterId`);--> statement-breakpoint
CREATE INDEX `clipsGuildIdx` ON `clips` (`guild`);