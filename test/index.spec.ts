import { SELF, createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

const IncomingRequest = Request< unknown | IncomingRequestCfProperties >

describe('worker fetch router', () => {
  it('responds with discord application id', async () => {
    const request = new IncomingRequest('http://example.com')
    const ctx = createExecutionContext()
    const response = await SELF.fetch(request)
    await waitOnExecutionContext(ctx)
    expect(await response.text()).toBe(`👋 ${env.DISCORD_APPLICATION_ID}`)
  })

  it('discord interaction endpoint responds with Bad request signature.', async () => {
    const request = new IncomingRequest('http://example.com', { method: 'POST' })
    const ctx = createExecutionContext()
    const response = await SELF.fetch(request)
    await waitOnExecutionContext(ctx)
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Bad request signature.')
  })

  // it('twitch eventsub endpoint responds with Signature verification failed', async () => {
  //   const request = new IncomingRequest('http://example.com/twitch-eventsub', { method: 'POST' })
  //   const ctx = createExecutionContext()
  //   const response = await SELF.fetch(request)
  //   await waitOnExecutionContext(ctx)
  //   expect(response.status).toBe(403)
  //   expect(await response.text()).toBe('Signature verification failed')
  // })

  it('responds with not found and proper status for /404', async () => {
    const request = new IncomingRequest('http://example.com/404')
    const ctx = createExecutionContext()
    const response = await SELF.fetch(request)
    await waitOnExecutionContext(ctx)
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Not Found.')
  })
})
