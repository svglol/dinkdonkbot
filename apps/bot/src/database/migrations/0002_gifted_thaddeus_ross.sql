-- 0002_alter_streams_table_message_default.sql

CREATE TABLE new_streams (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    broadcasterId TEXT NOT NULL,
    guild TEXT NOT NULL,
    channel TEXT NOT NULL,
    roleId TEXT,
    message TEXT DEFAULT '@everyone {{name}} is now live @ {{url}}'
);--> statement-breakpoint

INSERT INTO new_streams (id, name, broadcasterId, guild, channel, roleId, message)
SELECT id, name, broadcasterId, guild, channel, roleId, message
FROM streams;--> statement-breakpoint

DROP TABLE streams;--> statement-breakpoint

ALTER TABLE new_streams RENAME TO streams;--> statement-breakpoint

--> statement-breakpoint
CREATE UNIQUE INDEX `idIdx` ON `streams` (`id`);--> statement-breakpoint
CREATE INDEX `nameIdx` ON `streams` (`name`);--> statement-breakpoint
CREATE INDEX `broadcasterIdIdx` ON `streams` (`broadcasterId`);--> statement-breakpoint
CREATE INDEX `guildIdIdx` ON `streams` (`guild`);--> statement-breakpoint

UPDATE streams
SET message = '@everyone {{name}} is now live @ {{url}}'
WHERE message = '@everyone {{name}} is now live @ https://twitch.tv/{{name}}';