import { relations, sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, unique, uniqueIndex } from 'drizzle-orm/sqlite-core'

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

export const kickStreams = sqliteTable('kick-streams', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  broadcasterId: text('broadcasterId').notNull(),
  guildId: text('guild').notNull(),
  channelId: text('channel').notNull(),
  roleId: text('roleId'),
  liveMessage: text('message').default('@everyone {{name}} is now live @ {{url}}'),
  offlineMessage: text('offlineMessage').default('{{name}} is now offline'),
}, streams => [
  uniqueIndex('kick_idIdx').on(streams.id),
  index('kick_nameIdx').on(streams.name),
  index('kick_broadcasterIdIdx').on(streams.broadcasterId),
  index('kick_guildIdIdx').on(streams.guildId),
])

export const kickStreamMessages = sqliteTable('kick-stream-messages', {
  id: integer('id').primaryKey(),
  broadcasterId: text('broadcasterId').notNull(),
  streamStartedAt: text('streamStartedAt').notNull(),
  kickStreamId: integer('kickStreamId').notNull().references(() => kickStreams.id, { onDelete: 'cascade' }),
  discordChannelId: text('discordChannelId').notNull(),
  discordMessageId: text('discordMessageId').notNull(),
  embedData: text({ mode: 'json' }).$type<DiscordEmbed>(),
  createdAt: text('created_at').default(sql`(current_timestamp)`),
}, messages => [
  uniqueIndex('kick_messages_idIdx').on(messages.id),
  unique('kick_messages_uniqueIdx').on(messages.broadcasterId, messages.streamStartedAt, messages.kickStreamId),
  index('kick_messages_broadcasterIdIdx').on(messages.broadcasterId),
  index('kick_messages_streamStartedAtIdx').on(messages.streamStartedAt),
  index('kick_messages_kickStreamIdIdx').on(messages.kickStreamId),
  index('kick_messages_discordChannelIdIdx').on(messages.discordChannelId),
])

export const twitchStreamMessages = sqliteTable('twitch-stream-messages', {
  id: integer('id').primaryKey(),
  broadcasterId: text('broadcasterId').notNull(),
  streamStartedAt: text('streamStartedAt').notNull(),
  streamId: integer('streamId').notNull().references(() => streams.id, { onDelete: 'cascade' }),
  discordChannelId: text('discordChannelId').notNull(),
  discordMessageId: text('discordMessageId').notNull(),
  twitchStreamId: text('twitchStreamId').notNull(),
  embedData: text({ mode: 'json' }).$type<DiscordEmbed>(),
  createdAt: text('created_at').default(sql`(current_timestamp)`),
}, messages => [
  uniqueIndex('twitch_messages_idIdx').on(messages.id),
  unique('twitch_messages_uniqueIdx').on(messages.broadcasterId, messages.streamStartedAt, messages.streamId),
  index('twitch_messages_broadcasterIdIdx').on(messages.broadcasterId),
  index('twitch_messages_streamIdIdx').on(messages.streamId),
  index('twitch_messages_discordChannelIdIdx').on(messages.discordChannelId),
])

export const kickStreamsMessagesRelations = relations(kickStreamMessages, ({ one }) => ({
  kickStream: one(kickStreams, {
    fields: [kickStreamMessages.kickStreamId],
    references: [kickStreams.id],
  }),
}))

export const twitchStreamMessagesRelations = relations(twitchStreamMessages, ({ one }) => ({
  stream: one(streams, {
    fields: [twitchStreamMessages.streamId],
    references: [streams.id],
  }),
}))

export const kickStreamsRelations = relations(kickStreams, ({ many }) => ({
  messages: many(kickStreamMessages),
}))

export const streamsRelations = relations(streams, ({ many }) => ({
  messages: many(twitchStreamMessages),
}))
