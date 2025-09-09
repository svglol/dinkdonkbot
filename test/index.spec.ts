import worker from '@server'
import { createExecutionContext, createScheduledController, env, SELF, waitOnExecutionContext } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

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

  it('kick eventsub endpoint responds with Signature verification failed', async () => {
    const response = await SELF.fetch('http://example.com/kick-eventsub', { method: 'POST' })
    expect(response.status).toBe(403)
    expect(await response.text()).toBe('Signature verification failed')
  })

  it('responds with not found and proper status for /404', async () => {
    const response = await SELF.fetch('http://example.com/404')
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Not Found.')
  })

  it('static images are served', async () => {
    // twitch
    const twitch = await SELF.fetch('http://example.com/static/twitch-logo.png')
    expect(twitch.status).toBe(200)
    expect(await twitch.blob()).toBeInstanceOf(Blob)

    // kick
    const kick = await SELF.fetch('http://example.com/static/kick-logo.png')
    expect(kick.status).toBe(200)
    expect(await kick.blob()).toBeInstanceOf(Blob)
  })

  it('calls scheduled handler', async () => {
    const ctrl = createScheduledController({
      scheduledTime: new Date(1000),
      cron: '0 0 * * *',
    })
    const ctx = createExecutionContext()
    await worker.scheduled(ctrl, env, ctx)
    await waitOnExecutionContext(ctx)
  })
})
