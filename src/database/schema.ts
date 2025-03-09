import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const streams = sqliteTable('streams', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  broadcasterId: text('broadcasterId').notNull(),
  guildId: text('guild').notNull(),
  channelId: text('channel').notNull(),
  roleId: text('roleId'),
  liveMessage: text('message').default('@everyone {{name}} is now live @ {{url}}'),
  offlineMessage: text('offlineMessage').default('{{name}} is now offline'),
}, streams => [
  uniqueIndex('idIdx').on(streams.id),
  index('nameIdx').on(streams.name),
  index('broadcasterIdIdx').on(streams.broadcasterId),
  index('guildIdIdx').on(streams.guildId),
])

export const clips = sqliteTable('clips', {
  id: integer('id').primaryKey(),
  streamer: text('streamer').notNull(),
  broadcasterId: text('broadcasterId').notNull(),
  guildId: text('guild').notNull(),
  channelId: text('channel').notNull(),
}, clips => [
  uniqueIndex('clipsidIdx').on(clips.id),
  index('clipsStreamerIdx').on(clips.streamer),
  index('clipsBroadcasterIdx').on(streams.broadcasterId),
  index('clipsGuildIdx').on(clips.guildId),
])
