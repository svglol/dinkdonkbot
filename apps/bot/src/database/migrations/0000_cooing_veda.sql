CREATE TABLE `streams` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`broadcasterId` text NOT NULL,
	`guild` text NOT NULL,
	`channel` text NOT NULL,
	`roleId` text,
	`message` text DEFAULT '@everyone'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idIdx` ON `streams` (`id`);--> statement-breakpoint
CREATE INDEX `nameIdx` ON `streams` (`name`);--> statement-breakpoint
CREATE INDEX `broadcasterIdIdx` ON `streams` (`broadcasterId`);--> statement-breakpoint
CREATE INDEX `guildIdIdx` ON `streams` (`guild`);