import type { Stream } from '../database/db'
import { useDB } from '../database/db'
import { messageBuilder, sendMessage, updateMessage } from '../discord/discord'
import { formatDuration } from '../util/formatDuration'
import { getKickChannelV2, getKickLivestream, kickUnsubscribe } from './kick'

/**
 * Handles a 'livestream.status.updated' event by sending a live message to all subscribers.
 *
 * @param eventType - The type of the event. Must be 'livestream.status.updated'.
 * @param payload - The payload containing the event data and subscription details.
 * @param env - The environment variables for accessing configuration and services.
 */
export async function kickEventHandler(eventType: string, payload: KickLivestreamStatusUpdatedEvent, env: Env) {
  if (eventType !== 'livestream.status.updated') {
    throw new Error(`Invalid event type: ${eventType}`)
  }

  if (payload.is_live && payload.ended_at === null) {
    await streamOnline(payload, env)
  }
  else {
    await streamOffline(payload, env)
  }
}

/**
 * Handles a 'livestream.status.updated' event by sending a live message to all subscribers.
 *
 * @param payload - The payload containing the event data and subscription details.
 * @param env - The environment variables for accessing configuration and services.
 */
async function streamOnline(payload: KickLivestreamStatusUpdatedEvent, env: Env) {
  const broadcasterId = payload.broadcaster.user_id

  const subscriptions = await useDB(env).query.kickStreams.findMany({
    where: (kickStreams, { eq }) => eq(kickStreams.broadcasterId, broadcasterId.toString()),
  })

  // send message to all subscriptions
  if (subscriptions.length > 0) {
    const [kickUser, kickLivestream] = await Promise.all([
      await getKickChannelV2(payload.broadcaster.channel_slug),
      await getKickLivestream(broadcasterId, env),
    ])

    const messagesPromises = subscriptions.map(async (sub) => {
      const body = kickLiveBodyBuilder({ sub, streamerData: kickUser, streamData: kickLivestream, eventData: payload })
      return sendMessage(sub.channelId, env.DISCORD_TOKEN, body, env)
        .then((messageId) => {
          if (messageId)
            return { messageId, channelId: sub.channelId, embed: body.embeds[body.embeds.length - 1], dbStreamId: sub.id }
        })
    })
    const messages = await Promise.all(messagesPromises)

    // add message IDs to KV
    const messagesToUpdate = { streamId: payload.broadcaster.user_id, messages }
    await env.KV.put(`discord-messages-kick-${broadcasterId}`, JSON.stringify(messagesToUpdate), { expirationTtl: 50 * 60 * 60 })
  }
  else {
    // remove subscription if no one is subscribed
    await kickUnsubscribe(broadcasterId, env)
  }
}

/**
 * Handles a 'livestream.status.updated' event by updating all subscribed Discord channels with an offline
 * message. If a VOD is available, it adds a button to watch the VOD.
 *
 * @param payload - The payload containing the event data and subscription details.
 * @param env - The environment variables for accessing configuration and services.
 */
async function streamOffline(payload: KickLivestreamStatusUpdatedEvent, env: Env) {
  const broadcasterId = payload.broadcaster.user_id
  const broadcasterName = payload.broadcaster.username
  const channelInfo = await getKickChannelV2(payload.broadcaster.username)
  const messagesToUpdate = await env.KV.get(`discord-messages-kick-${broadcasterId}`, { type: 'json' }) as KVDiscordMessage
  if (messagesToUpdate) {
    const updatePromises = messagesToUpdate.messages.map(async (message) => {
      // update embed with offline message
      const duration = formatDuration(new Date(payload.ended_at).getTime() - new Date(payload.started_at).getTime())
      message.embed.timestamp = new Date(payload.ended_at).toISOString()
      message.embed.description = `Streamed for **${duration}**`
      if (message.embed.footer)
        message.embed.footer.text = 'Last online'

      if (channelInfo && channelInfo.offline_banner_image && message.embed.image)
        message.embed.image.url = channelInfo.offline_banner_image.src || 'https://kick.com/img/default-channel-banners/offline.webp'

      message.embed.fields = []

      const sub = await useDB(env).query.streams.findFirst({
        where: (streams, { eq }) => eq(streams.id, message.dbStreamId),
      })
      const offlineMessage = messageBuilder(sub?.offlineMessage ? sub.offlineMessage : '{{name}} is now offline.', broadcasterName)

      return updateMessage(message.channelId, message.messageId, env.DISCORD_TOKEN, { content: offlineMessage, embeds: [message.embed], components: [] })
    })
    await Promise.all(updatePromises)

    await env.KV.delete(`discord-messages-${broadcasterId}`)
  }
}

/**
 * Builds a Discord message body for a live notification.
 * @param sub - The subscription that triggered the notification.
 * @param sub.sub - The subscrition object from the database.
 * @param sub.streamerData - The Kick channel data for the stream. Optional.
 * @param sub.streamData - The Kick stream data for the stream. Optional.
 * @param sub.eventData - The Kick event data for the stream. Optional.
 * @returns A DiscordBody object containing the message to be sent.
 */
export function kickLiveBodyBuilder({ sub, streamerData, streamData, eventData }: { sub: Stream, streamerData?: KickChannelV2 | null, streamData?: KickLiveStream | null, eventData?: KickLivestreamStatusUpdatedEvent | null }) {
  const components: DiscordComponent[] = []
  const component = {
    type: 1,
    components: [
      {
        type: 2,
        label: 'Watch Kick Stream',
        url: `https://kick.com/${sub.name}`,
        style: 5,
      },
    ],
  }
  components.push(component)
  const embeds: DiscordEmbed[] = []
  let title = `${streamerData?.slug ?? sub.name} is live!`
  let thumbnail = streamerData?.offline_banner_image?.src || 'https://kick.com/img/default-channel-banners/offline.webp'
  let timestamp = new Date().toISOString()
  if (eventData) {
    title = eventData.title
  }
  if (streamData) {
    thumbnail = `${streamData.thumbnail}?b=${streamData.started_at}`
    timestamp = new Date(streamData.started_at).toISOString()
  }
  const embed = {
    title,
    color: 0x53FC18,
    description: `**${sub.name} is live!**`,
    fields: [
      {
        name: 'Game',
        value: streamData?.category.name ?? 'No game',
      },
    ],
    url: `https://kick.com/${sub.name}`,
    image: {
      url: thumbnail,
    },
    thumbnail: {
      url: streamerData?.user.profile_pic ?? '',
    },
    timestamp,
    footer: {
      text: 'Online',
      icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Kick.com_icon_logo.svg/2048px-Kick.com_icon_logo.svg.png',
    },
  }
  embeds.push(embed)

  const roleMention = sub.roleId && sub.roleId !== sub.guildId ? `<@&${sub.roleId}> ` : ''
  const message = `${roleMention}${messageBuilder(sub.liveMessage ? sub.liveMessage : '{{name}} is live!', sub.name, streamData?.category.name, streamData?.started_at, 'kick')}`

  return {
    content: message,
    embeds,
    components,
  }
}
