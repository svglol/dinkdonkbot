import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        singleWorker: true,
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          compatibilityDate: '2024-01-01',
          compatibilityFlags: [
            'nodejs_compat',
            'service_binding_extra_handlers',
          ],
          bindings: {
            DISCORD_APPLICATION_ID: '1234567890',
            TWITCH_EVENT_SECRET: '1234567890',
          },
        },
      },
    },
  },
})
