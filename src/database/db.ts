import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export * as tables from './schema'
export { and, eq, like, or, sql } from 'drizzle-orm'
let _db:
  | DrizzleD1Database<typeof schema>
  | null = null

export function useDB(env: Env) {
  if (!_db) {
    if (env.DB)
      _db = drizzle(env.DB, { schema })

    else
      throw new Error('No database configured')
  }
  return _db
}

export function isTuple<T>(array: T[]): array is [T, ...T[]] {
  return array.length > 0
}

export type Stream = typeof schema.streams.$inferSelect & {
  multiStream?: MultiStream | null
}

export type StreamKick = typeof schema.kickStreams.$inferSelect & {
  multiStream?: MultiStream | null
}

export type MultiStream = typeof schema.multiStream.$inferSelect

export type StreamMessage = typeof schema.streamMessages.$inferSelect & {
  stream?: Stream | null
  kickStream?: StreamKick | null
}
