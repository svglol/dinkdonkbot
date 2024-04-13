/**
 * The core server that runs on a Cloudflare worker.
 */
import type { IRequest } from 'itty-router'
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
  async fetch(request: IRequest, env: Env, ctx: ExecutionContext) {
    return router.fetch(request, env, ctx)
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
router.post('/', async (request, env: Env, ctx: ExecutionContext) => {
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
    ctx.waitUntil(proccessInteraction(interaction, env))
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

  if (`sha256=${hexSignature}` !== signature) {
    console.error('Signature verification failed')
    return new Response('Signature verification failed', { status: 403 })
  }

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
    if (payload.subscription.type === 'stream.online') {
      const broadcasterId = event.broadcaster_user_id

      const subscriptions = await useDB(env).query.streams.findMany({
        where: (streams, { eq }) => eq(streams.broadcasterId, broadcasterId),
      })

      // send message to all subscriptions
      const messagesPromises = subscriptions.map(async (sub) => {
        const message = liveMessageBuilder(sub)
        const embed = await liveMessageEmbedBuilder(sub, env)
        return sendMessage(sub.channelId, message, env.DISCORD_TOKEN, embed).then(messageId => ({ messageId, channelId: sub.channelId, embed }))
      })
      const messages = await Promise.all(messagesPromises)

      // add message IDs to KV
      const messagesToUpdate = { messages }
      await env.KV.put(`discord-messages-${broadcasterId}`, JSON.stringify(messagesToUpdate), { expirationTtl: 50 * 60 * 60 })

      // remove subscription if no one is subscribed
      if (subscriptions.length === 0)
        await removeSubscription(broadcasterId, env)
    }
    else if (payload.subscription.type === 'stream.offline') {
      const broadcasterId = event.broadcaster_user_id
      const broadcasterName = event.broadcaster_user_name
      const streamerData = await getStreamerDetails(broadcasterName, env)
      const messagesToUpdate = await env.KV.get(`discord-messages-${broadcasterId}`, { type: 'json' }) as { messages: { messageId: string, channelId: string, embed: DiscordEmbed }[] }
      if (messagesToUpdate) {
        const updatePromises = messagesToUpdate.messages.map((message) => {
          // update embed with offline message
          const liveTimeInMilliseconds = Date.now() - new Date(message.embed.timestamp).getTime()

          message.embed.timestamp = new Date().toISOString()
          message.embed.description = `Streamed for **${formatDuration(liveTimeInMilliseconds)}**`
          message.embed.footer.text = 'Last online'
          if (streamerData.offline_image_url)
            message.embed.image.url = streamerData.offline_image_url
          message.embed.fields = []

          return updateMessage(message.channelId, message.messageId, `**${broadcasterName}** was live`, env.DISCORD_TOKEN, message.embed)
        })
        await Promise.all(updatePromises)

        await env.KV.delete(`discord-messages-${broadcasterId}`)
      }
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
    const message = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${discordToken}`,
      },
      body: JSON.stringify(body),
    })
    if (!message.ok)
      throw new Error(`Failed to send message: ${await message.text()}`)

    const data = await message.json() as { id: string }
    return data.id
  }
  catch (error) {
    console.error('Error sending message:', error)
  }
}

async function updateMessage(channelId: string, messageId: string, messageContent: string, discordToken: string, embed?: any) {
  const url = `https://discord.com/api/channels/${channelId}/messages/${messageId}`
  const body = {
    content: messageContent,
    embeds: [],
  }
  if (embed)
    body.embeds.push(embed)

  try {
    const message = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${discordToken}`,
      },
      body: JSON.stringify(body),
    })
    if (!message.ok)
      throw new Error(`Failed to update message: ${await message.text()}`)

    const data = await message.json() as { id: string }
    return data.id
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
  let message = ''
  if (sub.roleId && sub.roleId !== sub.guildId)
    message += ` <@&${sub.roleId}> `

  message += sub.message.replace(/\{\{name\}\}/gi, sub.name)

  return message
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
    footer: {
      text: 'Online',
    },
  }
}

function formatDuration(durationInMilliseconds: number) {
  const seconds = Math.floor(durationInMilliseconds / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  const formattedHours = hours > 0 ? `${hours}h` : ''
  const formattedMinutes = minutes > 0 ? `${minutes}m` : ''
  const formattedSeconds = remainingSeconds > 0 ? `${remainingSeconds}s` : ''

  return `${formattedHours}${formattedMinutes}${formattedSeconds}`
}

async function updateInteraction(interaction: DiscordInteraction, body: object, env: Env) {
  try {
    const defer = await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/@original`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!defer.ok)
      throw new Error(`Failed to update interaction: ${await defer.text()}`)
  }
  catch (error) {
    console.error('Error updating interaction:', error)
  }
  return true
}

async function proccessInteraction(interaction: DiscordInteraction, env: Env) {
  switch (interaction.data.name.toLowerCase()) {
    case INVITE_COMMAND.name.toLowerCase(): {
      const applicationId = env.DISCORD_APPLICATION_ID
      const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${applicationId}&permissions=131072&scope=applications.commands+bot`
      return await updateInteraction(interaction, { content: INVITE_URL }, env)
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
          if (!server || !streamer || !channel)
            return await updateInteraction(interaction, { content: 'Invalid arguments' }, env)

          // check if already subscribed to this channel
          const subscriptions = await useDB(env).query.streams.findMany({
            where: (streams, { eq, and, like }) => and(eq(streams.guildId, server), like(streams.name, streamer)),
          })
          if (subscriptions.length > 0)
            return await updateInteraction(interaction, { content: 'Already subscribed to this streamer' }, env)

          // check if twitch channel exists
          const channelId = await getChannelId(streamer, env)
          if (!channelId)
            return await updateInteraction(interaction, { content: 'Could not find twitch channel' }, env)

          // subscribe to event sub for this channel
          const subscribed = await subscribe(channelId, env)
          if (!subscribed)
            return await updateInteraction(interaction, { content: 'Could not subscribe to this twitch channel' }, env)

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

          return await updateInteraction(interaction, { content: `Successfully subscribed to notifications for **${streamer}** in <#${channel}>` }, env)
        }
        case 'remove': {
          const remove = interaction.data.options.find(option => option.name === 'remove') as DiscordSubCommand
          const streamer = remove.options.find(option => option.name === 'streamer').value as string
          const stream = await useDB(env).query.streams.findFirst({
            where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
          })
          if (!stream)
            return await updateInteraction(interaction, { content: 'Could not find subscription' }, env)

          await useDB(env).delete(tables.streams).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))
          const subscriptions = await useDB(env).query.streams.findMany({
            where: (streams, { eq }) => eq(streams.name, streamer),
          })
          if (subscriptions.length === 0 && stream)
            await removeSubscription(stream.broadcasterId, env)

          return await updateInteraction(interaction, { content: `Successfully unsubscribed to notifications for **${streamer}**` }, env)
        }
        case 'edit':{
          const server = interaction.guild_id
          const edit = interaction.data.options.find(option => option.name === 'edit') as DiscordSubCommand
          const streamer = edit.options.find(option => option.name === 'streamer').value as string
          const dbStream = await useDB(env).query.streams.findFirst({
            where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
          })
          if (!dbStream)
            return await updateInteraction(interaction, { content: 'Could not find subscription' }, env)

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

          return await updateInteraction(interaction, { content: `Successfully edited notifications for **${streamer}**` }, env)
        }
        case 'list': {
          const streams = await useDB(env).query.streams.findMany({
            where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id),
          })
          let streamList = 'Not subscribed to any streams'
          if (streams.length > 0)
            streamList = streams.map(stream => `**${stream.name}** - <#${stream.channelId}>`).join('\n')

          return await updateInteraction(interaction, { content: streamList }, env)
        }
        case 'test':{
          const test = interaction.data.options.find(option => option.name === 'test') as DiscordSubCommand
          const streamer = test.options.find(option => option.name === 'streamer').value as string
          const global = test.options.find(option => option.name === 'global')
          const stream = await useDB(env).query.streams.findFirst({
            where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
          })
          if (!stream)
            return await updateInteraction(interaction, { content: 'Could not find subscription' }, env)

          const message = liveMessageBuilder(stream)
          const embed = await liveMessageEmbedBuilder(stream, env)
          if (global) {
            if (global.value as boolean) {
              await sendMessage(stream.channelId, message, env.DISCORD_TOKEN, embed)
              return await updateInteraction(interaction, { content: `Successfully sent test message for **${streamer}**` }, env)
            }
            else {
              return await updateInteraction(interaction, { content: message, embeds: [embed] }, env)
            }
          }
          else {
            return await updateInteraction(interaction, { content: message, embeds: [embed] }, env)
          }
        }
      }
    }
  }
}
