/**
 * The core server that runs on a Cloudflare worker.
 */
import { Router } from 'itty-router'
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions'
import { INVITE_COMMAND, TWITCH_COMMAND } from './commands'
import { getChannelId, getStreamDetails, getStreamerDetails, removeSubscription, subscribe } from './twitch'
import { and, eq, like, tables, useDB } from './database/db'

class JsonResponse extends Response {
  constructor(body, init = {}) {
    const jsonBody = JSON.stringify(body)

    const mergedInit = {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
      ...init,
    }

    super(jsonBody, mergedInit)
  }
}

const router = Router()

async function verifyDiscordRequest(request, env: Env) {
  const signature = request.headers.get('x-signature-ed25519')
  const timestamp = request.headers.get('x-signature-timestamp')
  const body = await request.text()
  const isValidRequest
    = signature
    && timestamp
    && verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY)
  if (!isValidRequest)
    return { isValid: false }

  return { interaction: JSON.parse(body) as DiscordInteraction, isValid: true }
}

const server = {
  verifyDiscordRequest,
  async fetch(request, env: Env) {
    return router.handle(request, env)
  },
}

export default server

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
router.post('/', async (request, env: Env) => {
  const { isValid, interaction } = await server.verifyDiscordRequest(
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
    // Most user commands will come as `APPLICATION_COMMAND`.
    switch (interaction.data.name.toLowerCase()) {
      case INVITE_COMMAND.name.toLowerCase(): {
        const applicationId = env.DISCORD_APPLICATION_ID
        const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${applicationId}&permissions=131072&scope=applications.commands+bot`
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: INVITE_URL,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        })
      }
      case TWITCH_COMMAND.name.toLowerCase(): {
        const option = interaction.data.options[0].name
        switch (option) {
          case 'add': {
            const server = interaction.guild_id
            const add = interaction.data.options.find(option => option.name === 'add') as DiscordSubCommand
            const streamer = add.options.find(option => option.name === 'streamer').value as string
            const channel = add.options.find(option => option.name === 'discord-channel').value as string
            const role = add.options.find(option => option.name === 'ping-role')
            const message = add.options.find(option => option.name === 'message')
            // make sure we have all arguments
            if (!server || !streamer || !channel) {
              return new JsonResponse({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: 'Invalid arguments',
                  flags: InteractionResponseFlags.EPHEMERAL,
                },
              })
            }

            // check if already subscribed to this channel
            const subscriptions = await useDB(env).query.streams.findMany({
              where: (streams, { eq, and, like }) => and(eq(streams.guildId, server), like(streams.name, streamer)),
            })
            if (subscriptions.length > 0) {
              return new JsonResponse({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: 'Already subscribed to this streamer',
                  flags: InteractionResponseFlags.EPHEMERAL,
                },
              })
            }

            // check if twitch channel exists
            const channelId = await getChannelId(streamer, env)
            if (!channelId) {
              return new JsonResponse({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: 'Could not find twitch channel',
                  flags: InteractionResponseFlags.EPHEMERAL,
                },
              })
            }

            // subscribe to event sub for this channel
            const subscribed = await subscribe(channelId, env)
            if (!subscribed) {
              return new JsonResponse({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: 'Could not subscribe to this twitch channel',
                  flags: InteractionResponseFlags.EPHEMERAL,
                },
              })
            }
            let roleId: string | undefined
            if (role) {
              roleId = role.value as string
              if (roleId === server)
                roleId = undefined
            }

            const messageText = message ? message.value as string : undefined

            // add to database
            await useDB(env).insert(tables.streams).values({
              name: (await getStreamerDetails(streamer, env)).display_name,
              broadcasterId: channelId,
              guildId: server,
              channelId: channel,
              roleId,
              message: messageText,
            })

            return new JsonResponse({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `Successfully subscribed to notifications for **${streamer}** in <#${channel}>`,
                flags: InteractionResponseFlags.EPHEMERAL,
              },
            })
          }
          case 'remove': {
            const remove = interaction.data.options.find(option => option.name === 'remove') as DiscordSubCommand
            const streamer = remove.options.find(option => option.name === 'streamer').value as string
            const stream = await useDB(env).query.streams.findFirst({
              where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
            })
            if (!stream) {
              return new JsonResponse({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: 'Could not find subscription',
                  flags: InteractionResponseFlags.EPHEMERAL,
                },
              })
            }
            await useDB(env).delete(tables.streams).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))
            const subscriptions = await useDB(env).query.streams.findMany({
              where: (streams, { eq }) => eq(streams.name, streamer),
            })
            if (subscriptions.length === 0 && stream)
              await removeSubscription(stream.broadcasterId, env)

            return new JsonResponse({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `Successfully unsubscribed to notifications for **${streamer}**`,
                flags: InteractionResponseFlags.EPHEMERAL,
              },
            })
          }
          case 'edit':{
            const server = interaction.guild_id
            const edit = interaction.data.options.find(option => option.name === 'edit') as DiscordSubCommand
            const streamer = edit.options.find(option => option.name === 'streamer').value as string
            const dbStream = await useDB(env).query.streams.findFirst({
              where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
            })
            if (!dbStream) {
              return new JsonResponse({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: 'Invalid arguments',
                  flags: InteractionResponseFlags.EPHEMERAL,
                },
              })
            }
            const channel = edit.options.find(option => option.name === 'discord-channel')
            if (channel)
              await useDB(env).update(tables.streams).set({ channelId: String(channel.value) }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))
            const role = edit.options.find(option => option.name === 'ping-role')
            let roleId: string | undefined
            if (role) {
              roleId = role.value as string
              if (roleId === server)
                roleId = undefined
            }
            if (roleId)
              await useDB(env).update(tables.streams).set({ roleId }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))

            const message = edit.options.find(option => option.name === 'message')
            if (message)
              await useDB(env).update(tables.streams).set({ message: message.value as string }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))
            return new JsonResponse({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `Successfully edited notifications for **${streamer}**`,
                flags: InteractionResponseFlags.EPHEMERAL,
              },
            })
          }
          case 'list': {
            const streams = await useDB(env).query.streams.findMany({
              where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id),
            })
            let streamList = 'Not subscribed to any streams'
            if (streams.length > 0)
              streamList = streams.map(stream => `**${stream.name}** - <#${stream.channelId}>`).join('\n')
            return new JsonResponse({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: streamList,
                flags: InteractionResponseFlags.EPHEMERAL,
              },
            })
          }
          case 'test':{
            const test = interaction.data.options.find(option => option.name === 'test') as DiscordSubCommand
            const streamer = test.options.find(option => option.name === 'streamer').value as string
            const global = test.options.find(option => option.name === 'global')
            const stream = await useDB(env).query.streams.findFirst({
              where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
            })
            if (!stream) {
              return new JsonResponse({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: 'Invalid arguments',
                  flags: InteractionResponseFlags.EPHEMERAL,
                },
              })
            }
            const message = liveMessageBuilder(stream)
            const embed = await liveMessageEmbedBuilder(stream, env)
            if (global) {
              if (global.value as boolean) {
                await sendMessage(stream.channelId, message, env.DISCORD_TOKEN, embed)
                return new JsonResponse({
                  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                  data: {
                    content: `Successfully sent test message for **${streamer}**`,
                    flags: InteractionResponseFlags.EPHEMERAL,
                  },
                })
              }
              else {
                return new JsonResponse({
                  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                  data: {
                    content: message,
                    embeds: [embed],
                    flags: InteractionResponseFlags.EPHEMERAL,
                  },
                })
              }
            }
            else {
              return new JsonResponse({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: message,
                  embeds: [embed],
                  flags: InteractionResponseFlags.EPHEMERAL,
                },
              })
            }
          }
        }
      }
        break
      default:
        return new JsonResponse({ error: 'Unknown Type' }, { status: 400 })
    }
  }

  console.error('Unknown Type')
  return new JsonResponse({ error: 'Unknown Type' }, { status: 400 })
})

// Twitch Event Sub Webhook
router.post('/twitch-eventsub', async (request, env: Env) => {
  const signature = request.headers.get('Twitch-Eventsub-Message-Signature')
  const messageId = request.headers.get('Twitch-Eventsub-Message-Id')
  const messageTimestamp = request.headers.get('Twitch-Eventsub-Message-Timestamp')
  const body = await request.text()
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

  if (`sha256=${hexSignature}` !== signature)
    return new Response('Signature verification failed', { status: 403 })

  const messageStore = await env.KV.get(`twitch-eventsub-${messageId}`)
  if (messageStore)
    return new Response('Duplicate message', { status: 409 })

  await env.KV.put(`twitch-eventsub-${messageId}`, 'true', { expirationTtl: 600 })

  if (new Date(messageTimestamp) < new Date(Date.now() - (10 * 60 * 1000)))
    return new Response('Message timestamp is older than 10 minutes', { status: 403 })

  const payload = JSON.parse(body) as SubscriptionEventResponseData

  if (payload.subscription.status === 'webhook_callback_verification_pending') {
    const challenge = payload.challenge
    return new Response(challenge, { status: 200 })
  }

  if (payload.event) {
    const event = payload.event
    if (event.type === 'live') {
      const broadcasterId = event.broadcaster_user_id

      const subscriptions = await useDB(env).query.streams.findMany({
        where: (streams, { eq }) => eq(streams.broadcasterId, broadcasterId),
      })

      // send message to all subscriptions
      for (const sub of subscriptions) {
        const message = liveMessageBuilder(sub)
        const embed = await liveMessageEmbedBuilder(sub, env)
        await sendMessage(sub.channelId, message, env.DISCORD_TOKEN, embed)
      }

      // remove subscription if no one is subscribed
      if (subscriptions.length === 0)
        await removeSubscription(broadcasterId, env)
    }
  }

  return new JsonResponse({ message: 'Success' }, { status: 200 })
})

router.all('*', () => new Response('Not Found.', { status: 404 }))

async function sendMessage(channelId: string, messageContent: string, discordToken: string, embed?: any) {
  const url = `https://discord.com/api/channels/${channelId}/messages`
  const body = {
    content: messageContent,
    embeds: [],
  }
  if (embed)
    body.embeds.push(embed)

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${discordToken}`,
      },
      body: JSON.stringify(body),
    })
  }
  catch (error) {
    console.error('Error sending message:', error)
  }
}

function liveMessageBuilder(sub: {
  name: string
  id: number
  broadcasterId: string
  guildId: string
  channelId: string
  roleId: string
  message: string
}) {
  let message = sub.message
  if (sub.roleId && sub.roleId !== sub.guildId)
    message += ` <@&${sub.roleId}> `
  return `${message} **${sub.name}** is now live https://twitch.tv/${sub.name}`
}

async function liveMessageEmbedBuilder(sub: {
  name: string
  id: number
  broadcasterId: string
  guildId: string
  channelId: string
  roleId: string
  message: string
}, env: Env) {
  const streamerData = await getStreamerDetails(sub.name, env)
  const streamData = await getStreamDetails(sub.name, env)
  let title = `${streamerData.display_name} is live!`
  let thumbnail = streamerData.offline_image_url
  let timestamp = new Date().toISOString()

  if (streamData) {
    title = streamData.title
    thumbnail = streamData.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')
    timestamp = new Date(streamData.started_at).toISOString()
  }

  return {
    title,
    color: 0x00EA5E9,
    description: `**${sub.name} is live!**`,
    fields: [
      {
        name: 'Game',
        value: streamData?.game_name ?? 'No game',
      },
    ],
    url: `https://twitch.tv/${sub.name}`,
    image: {
      url: thumbnail,
    },
    thumbnail: {
      url: streamerData.profile_image_url,
    },
    timestamp,
  }
}
