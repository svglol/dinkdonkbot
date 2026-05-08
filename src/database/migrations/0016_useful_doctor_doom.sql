CREATE TABLE `kick-clips` (
	`id` integer PRIMARY KEY NOT NULL,
	`streamer` text NOT NULL,
	`broadcasterId` text NOT NULL,
	`guild` text NOT NULL,
	`channel` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kick_clipsidIdx` ON `kick-clips` (`id`);--> statement-breakpoint
CREATE INDEX `kick_clipsStreamerIdx` ON `kick-clips` (`streamer`);--> statement-breakpoint
CREATE INDEX `kick_clipsBroadcasterIdx` ON `kick-clips` (`broadcasterId`);--> statement-breakpoint
CREATE INDEX `kick_clipsGuildIdx` ON `kick-clips` (`guild`);