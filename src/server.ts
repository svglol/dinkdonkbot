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
import * as commands from './commands'
import { getChannelId, getLatestVOD, getStreamDetails, getStreamerDetails, getSubscriptions, removeFailedSubscriptions, removeSubscription, subscribe } from './twitch'
import type { Stream } from './database/db'
import { and, eq, like, tables, useDB } from './database/db'
import { formatDuration } from './util/formatDuration'
import { sendMessage, updateInteraction, updateMessage } from './discord'

class JsonResponse extends Response {
  constructor(body: object, init = {}) {
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

async function verifyDiscordRequest(request: Request, env: Env) {
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
  async fetch(request, env: Env, ctx: ExecutionContext) {
    return router.fetch(request, env, ctx)
  },
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(scheduledCheck(env))
  },
} satisfies ExportedHandler<Env>

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

  if (new Date(String(messageTimestamp)) < new Date(Date.now() - (10 * 60 * 1000)))
    return new Response('Message timestamp is older than 10 minutes', { status: 403 })

  const payload = JSON.parse(body) as SubscriptionEventResponseData<SubscriptionType>

  if (payload.subscription.status === 'webhook_callback_verification_pending') {
    const challenge = payload.challenge
    return new Response(challenge, { status: 200 })
  }

  if (payload.event) {
    if (payload.subscription.type === 'stream.online') {
      const event = payload.event as OnlineEventData
      const broadcasterId = event.broadcaster_user_id

      const subscriptions = await useDB(env).query.streams.findMany({
        where: (streams, { eq }) => eq(streams.broadcasterId, broadcasterId),
      })

      // send message to all subscriptions
      if (subscriptions.length > 0) {
        const streamData = await getStreamDetails(event.broadcaster_user_name, env)
        const streamerData = await getStreamerDetails(event.broadcaster_user_id, env)
        const messagesPromises = subscriptions.map(async (sub) => {
          const body = liveBodyBuilder({ sub, streamerData, streamData })
          return sendMessage(sub.channelId, env.DISCORD_TOKEN, body)
            .then((messageId) => {
              if (messageId)
                return { messageId, channelId: sub.channelId, embed: body.embeds[body.embeds.length - 1], dbStreamId: sub.id }
            })
        })
        const messages = await Promise.all(messagesPromises)

        // add message IDs to KV
        const messagesToUpdate = { streamId: event.id, messages }
        await env.KV.put(`discord-messages-${broadcasterId}`, JSON.stringify(messagesToUpdate), { expirationTtl: 50 * 60 * 60 })
      }
      else {
      // remove subscription if no one is subscribed
        await removeSubscription(broadcasterId, env)
      }
    }
    else if (payload.subscription.type === 'stream.offline') {
      const event = payload.event as OfflineEventData
      const broadcasterId = event.broadcaster_user_id
      const broadcasterName = event.broadcaster_user_name
      const streamerData = await getStreamerDetails(broadcasterName, env)
      const messagesToUpdate = await env.KV.get(`discord-messages-${broadcasterId}`, { type: 'json' }) as KVDiscordMessage
      if (messagesToUpdate) {
        const components: DiscordComponent[] = []
        const latestVOD = await getLatestVOD(broadcasterId, messagesToUpdate.streamId, env)
        if (latestVOD) {
          components.push(
            {
              type: 1,
              components: [
                {
                  type: 2,
                  label: 'Watch VOD',
                  url: latestVOD.url,
                  style: 5,
                },
              ],
            },
          )
        }
        const updatePromises = messagesToUpdate.messages.map(async (message) => {
          // update embed with offline message
          const duration = latestVOD ? latestVOD.duration : formatDuration(Date.now() - new Date(message.embed.timestamp ? message.embed.timestamp : '').getTime())
          message.embed.timestamp = new Date().toISOString()
          message.embed.description = `Streamed for **${duration}**`
          if (message.embed.footer)
            message.embed.footer.text = 'Last online'

          if (streamerData && streamerData.offline_image_url && message.embed.image)
            message.embed.image.url = streamerData.offline_image_url
          message.embed.fields = []
          const sub = await useDB(env).query.streams.findFirst({
            where: (streams, { eq }) => eq(streams.id, message.dbStreamId),
          })
          const offlineMessage = messageBuilder(sub?.offlineMessage ? sub.offlineMessage : '{{name}} is now offline.', broadcasterName)

          return updateMessage(message.channelId, message.messageId, env.DISCORD_TOKEN, { content: offlineMessage, embeds: [message.embed], components })
        })
        await Promise.all(updatePromises)

        await env.KV.delete(`discord-messages-${broadcasterId}`)
      }
    }
  }

  return new JsonResponse({ message: 'Success' }, { status: 200 })
})

router.all('*', () => new Response('Not Found.', { status: 404 }))

function liveBodyBuilder({ sub, streamerData, streamData }: { sub: Stream, streamerData?: TwitchUser | null, streamData?: TwitchStream | null }) {
  const components: DiscordComponent[] = []
  const component = {
    type: 1,
    components: [
      {
        type: 2,
        label: 'Watch Stream',
        url: `https://twitch.tv/${sub.name}`,
        style: 5,
      },
    ],
  }
  components.push(component)
  const embeds: DiscordEmbed[] = []
  let title = `${streamerData ? streamerData.display_name : sub.name} is live!`
  let thumbnail = streamData?.thumbnail_url ?? streamerData?.offline_image_url ?? ''
  let timestamp = new Date().toISOString()

  if (streamData) {
    title = streamData.title
    thumbnail = `${streamData.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')}?b=${streamData.id}`
    timestamp = new Date(streamData.started_at).toISOString()
  }
  const embed = {
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
      url: streamerData ? streamerData.profile_image_url : '',
    },
    timestamp,
    footer: {
      text: 'Online',
    },
  }
  embeds.push(embed)

  const roleMention = sub.roleId && sub.roleId !== sub.guildId ? `<@&${sub.roleId}> ` : ''
  const message = `${roleMention}${messageBuilder(sub.liveMessage ? sub.liveMessage : '{{name}} is live!', sub.name, streamData?.game_name)}`

  return {
    content: message,
    embeds,
    components,
  }
}

function messageBuilder(message: string, streamName: string, game?: string) {
  return message.replace(/\{\{name\}\}/gi, streamName)
    .replace(/\{\{url\}\}/gi, `https://twitch.tv/${streamName}`)
    .replace(/\{\{everyone\}\}/gi, '@everyone')
    .replace(/\{\{here\}\}/gi, '@here')
    .replace(/\{\{(game|category)\}\}/gi, game || '')
}

async function proccessInteraction(interaction: DiscordInteraction, env: Env) {
  if (!interaction.data)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid interaction' })

  switch (interaction.data.name.toLowerCase()) {
    case commands.INVITE_COMMAND.name.toLowerCase(): {
      const applicationId = env.DISCORD_APPLICATION_ID
      const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${applicationId}&permissions=131072&scope=applications.commands+bot`
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: INVITE_URL })
    }
    case commands.TWITCH_COMMAND.name.toLowerCase(): {
      if (!interaction.data.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const option = interaction.data.options[0].name
      switch (option) {
        case 'add': {
          const server = interaction.guild_id
          const add = interaction.data.options.find(option => option.name === 'add') as DiscordSubCommand
          if (!add || !add.options)
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
          const streamer = add.options.find(option => option.name === 'streamer')?.value as string
          const channel = add.options.find(option => option.name === 'discord-channel')?.value as string
          const role = add.options.find(option => option.name === 'ping-role')
          const message = add.options.find(option => option.name === 'live-message')
          const offlineMessage = add.options.find(option => option.name === 'offline-message')
          // make sure we have all arguments
          if (!server || !streamer || !channel)
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })

          // check if already subscribed to this channel
          const subscriptions = await useDB(env).query.streams.findMany({
            where: (streams, { eq, and, like }) => and(eq(streams.guildId, server), like(streams.name, streamer)),
          })
          if (subscriptions.length > 0)
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Already subscribed to this streamer' })

          // check if twitch channel exists
          const channelId = await getChannelId(streamer, env)
          if (!channelId)
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find twitch channel' })

          // subscribe to event sub for this channel
          const subscribed = await subscribe(channelId, env)
          if (!subscribed)
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not subscribe to this twitch channel' })

          let roleId: string | undefined
          if (role) {
            roleId = role.value as string
            if (roleId === server)
              roleId = undefined
          }

          const liveText = message ? message.value as string : undefined
          const offlineText = offlineMessage ? offlineMessage.value as string : undefined

          const streamerDetails = await getStreamerDetails(streamer, env)

          // add to database
          await useDB(env).insert(tables.streams).values({
            name: streamerDetails ? streamerDetails.display_name : streamer,
            broadcasterId: channelId,
            guildId: server,
            channelId: channel,
            roleId,
            liveMessage: liveText,
            offlineMessage: offlineText,
          })

          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Successfully subscribed to notifications for **${streamer}** in <#${channel}>` })
        }
        case 'remove': {
          const remove = interaction.data.options.find(option => option.name === 'remove') as DiscordSubCommand
          if (!remove || !remove.options)
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
          const streamer = remove.options.find(option => option.name === 'streamer')?.value as string
          const stream = await useDB(env).query.streams.findFirst({
            where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
          })
          if (!stream)
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription' })

          await useDB(env).delete(tables.streams).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))
          const subscriptions = await useDB(env).query.streams.findMany({
            where: (streams, { like }) => like(streams.name, streamer),
          })
          if (subscriptions.length === 0 && stream)
            await removeSubscription(stream.broadcasterId, env)

          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Successfully unsubscribed to notifications for **${streamer}**` })
        }
        case 'edit':{
          const server = interaction.guild_id
          const edit = interaction.data.options.find(option => option.name === 'edit') as DiscordSubCommand
          if (!edit || !edit.options)
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
          const streamer = edit.options.find(option => option.name === 'streamer')?.value as string
          const dbStream = await useDB(env).query.streams.findFirst({
            where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
          })
          if (!dbStream)
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription' })

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

          const message = edit.options.find(option => option.name === 'live-message')
          if (message)
            await useDB(env).update(tables.streams).set({ liveMessage: message.value as string }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))

          const offlineMessage = edit.options.find(option => option.name === 'offline-message')
          if (offlineMessage)
            await useDB(env).update(tables.streams).set({ offlineMessage: offlineMessage.value as string }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))

          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Successfully edited notifications for **${streamer}**` })
        }
        case 'list': {
          const streams = await useDB(env).query.streams.findMany({
            where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id),
          })
          let streamList = 'Not subscribed to any streams'
          if (streams.length > 0)
            streamList = streams.map(stream => `**${stream.name}** - <#${stream.channelId}>`).join('\n')

          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: streamList })
        }
        case 'test':{
          const test = interaction.data.options.find(option => option.name === 'test') as DiscordSubCommand
          if (!test || !test.options)
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
          const streamer = test.options.find(option => option.name === 'streamer')?.value as string
          const global = test.options.find(option => option.name === 'global')
          const stream = await useDB(env).query.streams.findFirst({
            where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
          })
          if (!stream)
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription' })

          const streamerData = await getStreamerDetails(stream.name, env)
          const body = liveBodyBuilder({ sub: stream, streamerData })
          if (global) {
            if (global.value as boolean) {
              await sendMessage(stream.channelId, env.DISCORD_TOKEN, body)
              return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Successfully sent test message for **${streamer}**` })
            }
            else {
              return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, body)
            }
          }
          else {
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, body)
          }
        }
        case 'details': {
          const details = interaction.data.options.find(option => option.name === 'details') as DiscordSubCommand
          if (!details || !details.options)
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
          const streamer = details.options.find(option => option.name === 'streamer')?.value as string
          const stream = await useDB(env).query.streams.findFirst({
            where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
          })
          if (!stream)
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription' })
          let message = `Streamer: \`${stream.name}\`\n`
          message += `Channel: <#${stream.channelId}>\n`
          message += `Live Message: \`${stream.liveMessage}\`\n`
          message += `Offline Message: \`${stream.offlineMessage}\`\n`
          if (stream.roleId)
            message += `\n Role: <@&${stream.roleId}>`

          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: message })
        }
        case 'help': {
          const embed = {
            title: 'Available commands',
            description: '',
            color: 0x00EA5E9,
            fields: [
              {
                name: '/twitch add <streamer> <discord-channel> <ping-role> <live-message> <offline-message>',
                value: 'Add a Twitch streamer to receive notifications for going online or offline\n<streamer> - The name of the streamer to add \n<discord-channel> - The discord channel to post to when the streamer goes live\n<ping-role> - What role to @ when the streamer goes live\n<live-message> - The message to post when the streamer goes live\n<offline-message> - The message to post when the streamer goes offline',
              },
              {
                name: '/twitch edit <streamer> <discord-channel> <ping-role> <live-message> <offline-message>',
                value: 'Edit a Twitch streamer\'s settings\n<streamer> - The name of the streamer to edit \n<discord-channel> - The discord channel to post to when the streamer goes live\n<ping-role> - What role to @ when the streamer goes live\n<live-message> - The message to post when the streamer goes live\n<offline-message> - The message to post when the streamer goes offline',
              },
              {
                name: '/twitch remove <streamer>',
                value: 'Remove a Twitch streamer from receiving notifications for going online or offline\n<streamer> - The name of the streamer to remove',
              },
              {
                name: '/twitch list',
                value: 'List the twitch streamers that you are subscribed to',
              },
              {
                name: '/twitch test <streamer> <global>',
                value: 'Test the notification for a streamer \n<streamer> - The name of the streamer to test \n<global> - Whether to send the message to everyone or not',
              },
              {
                name: '/twitch details <streamer>',
                value: 'Show the details for a streamer you are subscribed to\n<streamer> - The name of the streamer to show',
              },
              {
                name: '/twitch help',
                value: 'Get this help message',
              },
              {
                name: 'Message variables',
                value: '```{{name}} = the name of the streamer\n{{url}} = the url for the stream\n{{everyone}} = @everyone\n{{here}} = @here\n{{game}} or {{category}} = the game or category of the stream - only works on live message```',
              },
            ],
          }
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [embed] })
        }
      }
    }
  }
}

/**
 * Asynchronously checks to remove subscriptions for servers that the bot is no longer in,
 * and checks that the bot is subscribed to all events for streamers
 */
async function scheduledCheck(env: Env) {
  try {
    const streams = await useDB(env).select().from(tables.streams)

    // check if the bot is subscribed to any servers it shouldnt be
    const serversRes = await fetch(`https://discord.com/api/v9/users/@me/guilds`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${env.DISCORD_TOKEN}`,
      },
    })
    if (!serversRes.ok)
      throw new Error(`Failed to fetch servers: ${await serversRes.text()}`)

    const servers = await serversRes.json() as { id: string }[]

    if (servers.length > 0) {
      const serverIds = servers.map(server => server.id)
      const dbServerIds = [...new Set(streams.map(stream => stream.guildId))]
      const idsNotInServers = dbServerIds.filter(id => !serverIds.includes(id))
      const streamsToRemove = streams.filter(stream => idsNotInServers.includes(stream.guildId))

      const deleteStreamsAndSubscriptions = streamsToRemove.map(async (stream) => {
        await useDB(env).delete(tables.streams).where(eq(tables.streams.id, stream.id))
        const subscriptions = await useDB(env).query.streams.findMany({
          where: (streams, { like }) => like(streams.name, stream.name),
        })
        if (subscriptions.length === 0)
          await removeSubscription(stream.broadcasterId, env)
      })
      await Promise.all(deleteStreamsAndSubscriptions)
    }

    // check if twitch event sub is subscribed to all of our streams in the database
    await removeFailedSubscriptions(env)
    const twitchSubscriptions = await getSubscriptions(env)
    if (twitchSubscriptions) {
      const streamOnlineSubs = twitchSubscriptions.data.filter(sub => sub.type === 'stream.online' && sub.status === 'enabled').map(sub => sub.condition.broadcaster_user_id)
      const streamOfflineSubs = twitchSubscriptions.data.filter(sub => sub.type === 'stream.offline' && sub.status === 'enabled').map(sub => sub.condition.broadcaster_user_id)
      const broadcasterIds = [...new Set(streams.map(stream => stream.broadcasterId))]

      const broadcasterIdsWithoutSubs = broadcasterIds.filter(
        broadcasterId =>
          !streamOnlineSubs.includes(broadcasterId)
          && !streamOfflineSubs.includes(broadcasterId),
      )
      const subsciptionPromises = broadcasterIdsWithoutSubs.map(async (broadcasterId) => {
        return await subscribe(broadcasterId, env)
      })

      await Promise.all(subsciptionPromises)
    }
    return true
  }
  catch (error) {
    console.error('Error running scheduled check:', error)
    return false
  }
}
