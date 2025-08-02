import { eq, tables, useDB } from '../database/db'
import { liveBodyBuilder, messageBuilder, sendMessage, updateMessage } from '../discord/discord'
import { formatDuration } from '../util/formatDuration'
import { getLatestVOD, getStreamDetails, getStreamerDetails, removeSubscription } from './twitch'

/**
 * Handles a Twitch EventSub notification.
 *
 * @param payload - The payload from the EventSub notification
 * @param env - The environment variables
 */
export async function twitchEventHandler(payload: SubscriptionEventResponseData<SubscriptionType>, env: Env) {
  if (payload.event) {
    if (payload.subscription.type === 'stream.online') {
      await streamOnline(payload, env)
    }
    else if (payload.subscription.type === 'stream.offline') {
      await streamOffline(payload, env)
    }
  }
}
/**
 * Handles a 'stream.online' event by notifying all subscribed Discord channels.
 *
 * This function retrieves the broadcaster's information and details about the
 * current stream. It then constructs and sends a notification message to each
 * subscribed Discord channel. If no subscriptions are found, it removes the
 * Twitch subscription for the broadcaster.
 *
 * @param payload - The payload containing the event data and subscription details.
 * @param env - The environment variables for accessing configuration and services.
 */

async function streamOnline(payload: SubscriptionEventResponseData<SubscriptionType>, env: Env) {
  const event = payload.event as OnlineEventData
  const broadcasterId = event.broadcaster_user_id

  const subscriptions = await useDB(env).query.streams.findMany({
    where: (streams, { eq }) => eq(streams.broadcasterId, broadcasterId),
  })

  // send message to all subscriptions
  if (subscriptions.length > 0) {
    const [streamerData, streamData] = await Promise.all([
      getStreamerDetails(event.broadcaster_user_name, env),
      getStreamDetails(event.broadcaster_user_name, env),
    ])
    const messagesPromises = subscriptions.map(async (sub) => {
      const body = liveBodyBuilder({ sub, streamerData, streamData })
      return sendMessage(sub.channelId, env.DISCORD_TOKEN, body, env)
        .then((messageId) => {
          if (messageId)
            return { messageId, channelId: sub.channelId, embed: body.embeds[body.embeds.length - 1], dbStreamId: sub.id }
        })
    })
    const messages = (await Promise.all(messagesPromises)).flatMap(message =>
      message ? [message] : [],
    )

    // save messages to database
    await useDB(env).insert(tables.twitchStreamMessages).values(messages.map((message) => {
      return {
        broadcasterId,
        streamStartedAt: event.started_at,
        discordMessageId: message.messageId,
        discordChannelId: message.channelId,
        embedData: message.embed,
        streamId: message.dbStreamId,
        twitchStreamId: event.id,
      }
    }))
  }
  else {
    // remove subscription if no one is subscribed
    await removeSubscription(broadcasterId, env)
  }
}

/**
 * Handles a 'stream.offline' event by updating all subscribed Discord channels with an offline
 * message. If a VOD is available, it adds a button to watch the VOD.
 *
 * @param payload - The payload containing the event data and subscription details.
 * @param env - The environment variables for accessing configuration and services.
 */
async function streamOffline(payload: SubscriptionEventResponseData<SubscriptionType>, env: Env) {
  const event = payload.event as OfflineEventData
  const broadcasterId = event.broadcaster_user_id
  const broadcasterName = event.broadcaster_user_name
  const streamerData = await getStreamerDetails(broadcasterName, env)
  const messagesToUpdate = await useDB(env).query.twitchStreamMessages.findMany({
    where: (messages, { eq }) => eq(messages.broadcasterId, broadcasterId),
    with: {
      stream: true,
    },
  })

  if (messagesToUpdate?.length > 0) {
    const components: DiscordComponent[] = []

    const latestVOD = await getLatestVOD(broadcasterId, messagesToUpdate[0].twitchStreamId, env)
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
    const updatePromises = messagesToUpdate.map(async (message) => {
      if (!message.embedData)
        return
      // update embed with offline message
      const duration = latestVOD ? latestVOD.duration : formatDuration(Date.now() - new Date(message.embedData.timestamp ? message.embedData.timestamp : '').getTime())
      message.embedData.timestamp = new Date().toISOString()
      message.embedData.description = `Streamed for **${duration}**`
      if (message.embedData.footer)
        message.embedData.footer.text = 'Last online'

      if (message.embedData.author) {
        message.embedData.author.name = 'Twitch'
      }

      if (streamerData && streamerData.offline_image_url && message.embedData.image)
        message.embedData.image.url = streamerData.offline_image_url
      message.embedData.fields = []

      const offlineMessage = messageBuilder(message.stream?.offlineMessage ? message.stream.offlineMessage : '{{name}} is now offline.', broadcasterName)

      return updateMessage(message.discordChannelId, message.discordMessageId, env.DISCORD_TOKEN, { content: offlineMessage, embeds: [message.embedData], components })
    })
    await Promise.all(updatePromises)
    // delete all messages from db for this stream
    await useDB(env).delete(tables.twitchStreamMessages).where(eq(tables.twitchStreamMessages.broadcasterId, event.broadcaster_user_id))

    await env.KV.delete(`discord-messages-${broadcasterId}`)
  }
}
