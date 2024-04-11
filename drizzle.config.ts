import type { Config } from 'drizzle-kit'

export default {
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  driver: 'd1',
} satisfies Config
