import type { Stream } from '../database/db'
import { eq, tables, useDB } from '../database/db'
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
    const messages = (await Promise.all(messagesPromises)).flatMap(message =>
      message ? [message] : [],
    )

    // add messages to database
    await useDB(env).insert(tables.kickStreamMessages).values(messages.map((message) => {
      return {
        broadcasterId: broadcasterId.toString(),
        streamStartedAt: payload.started_at,
        discordMessageId: message.messageId,
        discordChannelId: message.channelId,
        embedData: message.embed,
        kickStreamId: message.dbStreamId,
      }
    }))
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
  const messagesToUpdate = await useDB(env).query.kickStreamMessages.findMany({
    where: (messages, { eq }) => eq(messages.broadcasterId, broadcasterId.toString()),
    with: {
      kickStream: true,
    },
  })
  if (messagesToUpdate) {
    const updatePromises = messagesToUpdate.map(async (message) => {
      if (!message.embedData)
        return
      // update embed with offline message
      const duration = formatDuration(new Date(payload.ended_at).getTime() - new Date(payload.started_at).getTime())
      message.embedData.timestamp = new Date(payload.ended_at).toISOString()
      message.embedData.description = `Streamed for **${duration}**`
      if (message.embedData.footer)
        message.embedData.footer.text = 'Last online'

      if (channelInfo && channelInfo.offline_banner_image && message.embedData.image)
        message.embedData.image.url = channelInfo.offline_banner_image.src || 'https://kick.com/img/default-channel-banners/offline.webp'

      message.embedData.fields = []

      const offlineMessage = messageBuilder(message.kickStream?.offlineMessage ? message.kickStream.offlineMessage : '{{name}} is now offline.', broadcasterName)

      return updateMessage(message.discordChannelId, message.discordMessageId, env.DISCORD_TOKEN, { content: offlineMessage, embeds: [message.embedData], components: [] })
    })
    await Promise.all(updatePromises)

    // delete all messages from db for this stream
    await useDB(env).delete(tables.kickStreamMessages).where(eq(tables.kickStreamMessages.broadcasterId, broadcasterId.toString()))
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
    author: {
      name: 'KICK',
      icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Kick.com_icon_logo.svg/2048px-Kick.com_icon_logo.svg.png',
    },
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
