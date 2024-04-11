import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const streams = sqliteTable('streams', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  broadcasterId: text('broadcasterId').notNull(),
  guildId: text('guild').notNull(),
  channelId: text('channel').notNull(),
  roleId: text('roleId'),
  message: text('message').default('@everyone'),
}, streams => ({
  idIdx: uniqueIndex('idIdx').on(streams.id),
  nameIdx: index('nameIdx').on(streams.name),
  broadcasterIdIdx: index('broadcasterIdIdx').on(streams.broadcasterId),
  guildIdIdx: index('guildIdIdx').on(streams.guildId),
}))
