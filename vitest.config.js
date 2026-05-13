import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        compatibilityDate: '2026-01-01',
        compatibilityFlags: [
          'nodejs_compat',
          'service_binding_extra_handlers',
        ],
        bindings: {
          DISCORD_APPLICATION_ID: '1234567890',
          TWITCH_EVENT_SECRET: '1234567890',
        },
      },
    }),
  ],
  test: {
    singleWorker: true,
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ['discord-api-types/v10', 'discord-api-types/utils', '@discordjs/rest'],
        },
      },
    },
  },
})
