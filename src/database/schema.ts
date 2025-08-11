import { relations, sql } from 'drizzle-orm'
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

export const streamMessages = sqliteTable('stream-messages', {
  id: integer('id').primaryKey(),
  streamId: integer('streamId').references(() => streams.id, { onDelete: 'cascade' }),
  kickStreamId: integer('kickStreamId').references(() => kickStreams.id, { onDelete: 'cascade' }),
  kickStreamStartedAt: integer('kickStreamStartedAt', { mode: 'timestamp' }),
  twitchStreamStartedAt: integer('twitchStreamStartedAt', { mode: 'timestamp' }),
  kickStreamEndedAt: integer('kickStreamEndedAt', { mode: 'timestamp' }),
  twitchStreamEndedAt: integer('twitchStreamEndedAt', { mode: 'timestamp' }),
  discordChannelId: text('discordChannelId').notNull(),
  discordMessageId: text('discordMessageId'),
  twitchStreamId: text('twitchStreamId'),
  twitchOnline: integer('twitchOnline', { mode: 'boolean' }).default(false),
  kickOnline: integer('kickOnline', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`(current_timestamp)`),
  twitchStreamData: text({ mode: 'json' }).$type<TwitchStream>(),
  twitchStreamerData: text({ mode: 'json' }).$type<TwitchUser>(),
  twitchVod: text({ mode: 'json' }).$type<VideoData>(),
  kickStreamData: text({ mode: 'json' }).$type<KickLiveStream>(),
  kickStreamerData: text({ mode: 'json' }).$type<KickChannelV2>(),
  kickVod: text({ mode: 'json' }).$type<KickVOD>(),

}, messages => [
  index('stream_messages_discord_channel_created_idx').on(messages.discordChannelId, messages.createdAt),
  index('stream_messages_stream_created_idx').on(messages.streamId, messages.createdAt),
  index('stream_messages_streamIdIdx').on(messages.streamId),
  index('stream_messages_kickStreamIdIdx').on(messages.kickStreamId),
  index('stream_messages_discordChannelId_idx').on(messages.discordChannelId),
  index('stream_messages_createdAt_idx').on(messages.createdAt),
  index('stream_messages_twitchOnline_idx').on(messages.twitchOnline),
  index('stream_messages_kickOnline_idx').on(messages.kickOnline),
])

export const streamMessageRelations = relations(streamMessages, ({ one }) => ({
  stream: one(streams, {
    fields: [streamMessages.streamId],
    references: [streams.id],
  }),
  kickStream: one(kickStreams, {
    fields: [streamMessages.kickStreamId],
    references: [kickStreams.id],
  }),
}))

export const kickStreamsRelations = relations(kickStreams, ({ many }) => ({
  messages: many(streamMessages),
}))

export const streamsRelations = relations(streams, ({ many }) => ({
  messages: many(streamMessages),
}))
