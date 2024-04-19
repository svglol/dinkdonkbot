import { SELF, env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import '../src/server'

describe('worker fetch router', () => {
  it('responds with discord application id', async () => {
    const response = await SELF.fetch('http://example.com')
    expect(await response.text()).toBe(`👋 ${env.DISCORD_APPLICATION_ID}`)
  })

  it('discord interaction endpoint responds with Bad request signature.', async () => {
    const response = await SELF.fetch('http://example.com', { method: 'POST' })
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Bad request signature.')
  })

  it('twitch eventsub endpoint responds with Signature verification failed', async () => {
    const response = await SELF.fetch('http://example.com/twitch-eventsub', { method: 'POST' })
    expect(response.status).toBe(403)
    expect(await response.text()).toBe('Signature verification failed')
  })

  it('responds with not found and proper status for /404', async () => {
    const response = await SELF.fetch('http://example.com/404')
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Not Found.')
  })

  it('dispatches scheduled event', async () => {
    // @ts-expect-error Types are incorrect
    const result = await SELF.scheduled({
      scheduledTime: new Date(1000),
      cron: '0 0 * * *',
    })
    expect(result.outcome).toBe('ok')
  })
})
