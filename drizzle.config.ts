import type { Config } from 'drizzle-kit'

export default {
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
} satisfies Config
