import type { LiveStream } from '@server'
import { and, eq, tables, useDB } from '@database'
import { bodyBuilder, deleteMessage, updateMessage } from '@discord-api'
import { getLatestVOD, getStreamDetails, getStreamerDetails } from './twitch'

/**
 * Handles a Twitch EventSub notification.
 *
 * @param payload - The payload from the EventSub notification
 * @param env - The environment variables
 */
export async function twitchEventHandler(payload: SubscriptionEventResponseData<SubscriptionType>, env: Env, ctx: ExecutionContext) {
  if (payload.event) {
    if (payload.subscription.type === 'stream.online') {
      ctx.waitUntil(streamOnline(payload, env))
    }
    else if (payload.subscription.type === 'stream.offline') {
      ctx.waitUntil(streamOffline(payload, env))
    }
    else if (payload.subscription.type === 'channel.update') {
      ctx.waitUntil(channelUpdate(payload, env))
    }
  }
}

/**
 * Handles a 'stream.online' event by sending a live message to all subscribers.
 *
 * @param payload - The payload containing the event data and subscription details.
 * @param env - The environment variables for accessing configuration and services.
 */
async function streamOnline(payload: SubscriptionEventResponseData<SubscriptionType>, env: Env) {
  const event = payload.event as OnlineEventData

  const [streamerData, streamData] = await Promise.all([
    getStreamerDetails(event.broadcaster_user_name, env),
    getStreamDetails(event.broadcaster_user_name, env),
  ])

  const streams = await useDB(env).query.streams.findMany({
    where: (streams, { eq }) => eq(streams.broadcasterId, event.broadcaster_user_id),
    with: {
      multiStream: true,
    },
  })

  for (const stream of streams) {
    if (stream.multiStream) {
      const durableObjectId = env.LIVESTREAM.idFromName(`multistream:${stream.multiStream.id}:${stream.multiStream.streamId}:${stream.multiStream.kickStreamId}`)
      const durableObject: DurableObjectStub<LiveStream> = env.LIVESTREAM.get(durableObjectId)
      await durableObject.handleStream({ platform: 'twitch', payload, stream, streamData, streamerData })
    }
    else {
      const durableObjectId = env.LIVESTREAM.idFromName(`twitch:${stream.id}`)
      const durableObject: DurableObjectStub<LiveStream> = env.LIVESTREAM.get(durableObjectId)
      await durableObject.handleStream({ platform: 'twitch', payload, stream, streamData, streamerData })
    }
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
  const streamMessages = await useDB(env).query.streamMessages.findMany({
    with: {
      stream: true,
      kickStream: true,
    },
    where: (messages, { eq, and }) => and(eq(messages.twitchOnline, true)),
  })

  const filteredStreamMessages = streamMessages.filter(message => message.stream?.broadcasterId === broadcasterId)

  if (filteredStreamMessages?.length > 0) {
    const latestVOD = filteredStreamMessages[0].twitchStreamId ? await getLatestVOD(broadcasterId, filteredStreamMessages[0].twitchStreamId, env) : undefined
    const updatePromises = filteredStreamMessages.map(async (message) => {
      // first we will update the database entry
      const updatedMessage = await useDB(env).update(tables.streamMessages).set({
        twitchOnline: false,
        twitchStreamEndedAt: new Date(),
        twitchVod: latestVOD,
      }).where(eq(tables.streamMessages.id, message.id)).returning({ id: tables.streamMessages.id }).get()

      const updatedMessageWithStreams = await useDB(env).query.streamMessages.findFirst({
        where: (messages, { eq }) => eq(messages.id, updatedMessage.id),
        with: {
          stream: true,
          kickStream: true,
        },
      })

      if (!updatedMessageWithStreams) {
        return
      }

      const discordMessage = await bodyBuilder(updatedMessageWithStreams, env)
      if ((discordMessage.embeds && discordMessage.embeds.length > 0) || (discordMessage.components && discordMessage.components?.length > 0)) {
        return await updateMessage(message.discordChannelId, message?.discordMessageId ?? '', env, discordMessage)
      }
      else if (message?.stream?.cleanup) {
        return await deleteMessage(message.discordChannelId, message?.discordMessageId ?? '', env)
      }
    })
    await Promise.allSettled(updatePromises)
    // delete all messages from db for this stream
    await useDB(env).delete(tables.streamMessages).where(and(eq(tables.streamMessages.kickOnline, false), eq(tables.streamMessages.twitchOnline, false)))
  }
}

/**
 * Handles a 'channel.update' event by updating all subscribed Discord messages with the updated
 * stream title and game.
 *
 * @param payload - The payload containing the event data and subscription details.
 * @param env - The environment variables for accessing configuration and services.
 */
async function channelUpdate(payload: SubscriptionEventResponseData<SubscriptionType>, env: Env) {
  const event = payload.event as ChannelUpdateEventData
  const broadcasterId = event.broadcaster_user_id
  const streamMessages = await useDB(env).query.streamMessages.findMany({
    with: {
      stream: true,
      kickStream: true,
    },
    where: (messages, { eq, and }) => and(eq(messages.twitchOnline, true)),
  })
  const filteredStreamMessages = streamMessages.filter(message => message.stream?.broadcasterId === broadcasterId)
  if (filteredStreamMessages?.length > 0) {
    const updatePromises = filteredStreamMessages.map(async (message) => {
      if (message.twitchStreamData) {
        await useDB(env).update(tables.streamMessages).set({
          twitchStreamData: {
            ...message.twitchStreamData,
            title: event.title,
            game_id: event.category_id,
            game_name: event.category_name,
            language: event.language,
          },
        }).where(eq(tables.streamMessages.id, message.id))
      }
      const updatedMessage = await useDB(env).query.streamMessages.findFirst({
        where: (messages, { eq }) => eq(messages.id, message.id),
        with: {
          stream: true,
          kickStream: true,
        },
      })

      if (!updatedMessage || !updatedMessage.discordChannelId || !updatedMessage.discordMessageId) {
        return
      }

      const discordMessage = await bodyBuilder(updatedMessage, env)
      return await updateMessage(message.discordChannelId, updatedMessage.discordMessageId, env, discordMessage)
    })
    await Promise.allSettled(updatePromises)
  }
}
