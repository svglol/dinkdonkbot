import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions'
import { Router } from 'itty-router'
import { discordInteractionHandler } from '../discord/interactionHandler'
import { twitchEventHandler } from '../twitch/eventHandler'
import { JsonResponse } from '../util/jsonResponse'

const router = Router()
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return router.fetch(request, env, ctx)
  },
}

/**
 * A simple :wave: hello page to verify the worker is working.
 */
router.get('/', (request, env: Env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`)
})

/**
 * Main route for all requests sent from Discord.  All incoming messages will
 * include a JSON payload described here:
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */
router.post('/', async (request, env: Env, ctx: ExecutionContext) => {
  const { isValid, interaction } = await verifyDiscordRequest(
    request,
    env,
  )
  if (!isValid || !interaction)
    return new Response('Bad request signature.', { status: 401 })

  if (interaction.type === InteractionType.PING) {
    // The `PING` message is used during the initial webhook handshake, and is
    // required to configure the webhook in the developer portal.
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    })
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    ctx.waitUntil(discordInteractionHandler(interaction, env))
    return new JsonResponse({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }

  console.error('Unknown Type')
  return new JsonResponse({ error: 'Unknown Type' }, { status: 400 })
})

/**
 * Main route for all requests sent from Twitch Eventsub.
 */
router.post('/twitch-eventsub', async (request, env: Env) => {
  const { isValid, body } = await verifyTwitchRequest(request, env)
  if (!isValid)
    return new Response('Signature verification failed', { status: 403 })

  const messageId = request.headers.get('Twitch-Eventsub-Message-Id')
  const messageTimestamp = request.headers.get('Twitch-Eventsub-Message-Timestamp')

  const messageStore = await env.KV.get(`twitch-eventsub-${messageId}`)
  if (messageStore)
    return new Response('Duplicate message', { status: 409 })

  if (new Date(String(messageTimestamp)) < new Date(Date.now() - (10 * 60 * 1000)))
    return new Response('Message timestamp is older than 10 minutes', { status: 403 })

  await env.KV.put(`twitch-eventsub-${messageId}`, 'true', { expirationTtl: 600 })

  const payload = JSON.parse(body) as SubscriptionEventResponseData<SubscriptionType>

  if (payload.subscription.status === 'webhook_callback_verification_pending') {
    return new Response(payload.challenge, { status: 200 })
  }

  // Process the Twitch event here...
  await twitchEventHandler(payload, env)

  return new JsonResponse({ message: 'Success' }, { status: 200 })
})

// all other routes return a 404
router.all('*', () => new Response('Not Found.', { status: 404 }))

/**
 * Verifies a request is from Twitch by checking the Twitch-Eventsub-Message-Signature header.
 * @param request The request to verify
 * @param env The environment variables to use
 * @returns An object with a single property, `isValid`, which is `true` if the request is valid, and `false` otherwise.
 */
async function verifyTwitchRequest(request: Request, env: Env) {
  const body = await request.text()
  const signature = request.headers.get('Twitch-Eventsub-Message-Signature') ?? ''
  const messageId = request.headers.get('Twitch-Eventsub-Message-Id') ?? ''
  const messageTimestamp = request.headers.get('Twitch-Eventsub-Message-Timestamp') ?? ''
  const message = `${messageId}${messageTimestamp}${body}`

  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const secretKey = encoder.encode(env.TWITCH_EVENT_SECRET)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    secretKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const computedSignature = await crypto.subtle.sign('HMAC', cryptoKey, data)
  const hexSignature = Array.from(new Uint8Array(computedSignature), b => b.toString(16).padStart(2, '0')).join('')

  if (`sha256=${hexSignature}` !== signature) {
    console.error('Twitch request verification failed')
    return { isValid: false, body }
  }

  return { isValid: true, body }
}

/**
 * Verify a request came from Discord, and that it's not a replay attack.
 * @param request The request to verify
 * @param env The environment variables to use
 * @returns An object with 2 properties: `isValid` and `interaction`
 * - `isValid` will be `true` if the request is valid, and `false` otherwise.
 * - `interaction` will be the parsed JSON payload of the request, or `undefined` if the request is invalid.
 */
async function verifyDiscordRequest(request: Request, env: Env) {
  const signature = request.headers.get('X-Signature-Ed25519') ?? ''
  const timestamp = request.headers.get('X-Signature-Timestamp') ?? ''
  const body = await request.text()
  const isValidRequest = await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY)
  if (!isValidRequest)
    return { isValid: false }

  return { interaction: JSON.parse(body) as DiscordInteraction, isValid: true }
}
