import type { ChannelState } from '../durable/ChannelState'
import { and, eq, tables, useDB } from '../database/db'
import { bodyBuilder, deleteMessage, updateMessage } from '../discord/discord'
import { getLatestVOD } from './twitch'

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
  const broadcasterName = event.broadcaster_user_name

  const durableObjectId = env.CHANNELSTATE.idFromName(broadcasterName.toLowerCase())
  const durableObject: DurableObjectStub<ChannelState> = env.CHANNELSTATE.get(durableObjectId)
  return await durableObject.handleStream({ platform: 'twitch', payload })
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

      const discordMessage = bodyBuilder(updatedMessageWithStreams, env)
      if ((discordMessage.embeds && discordMessage.embeds.length > 0) || (discordMessage.components && discordMessage.components?.length > 0)) {
        return await updateMessage(message.discordChannelId, message?.discordMessageId ?? '', env.DISCORD_TOKEN, discordMessage)
      }
      else if (message?.stream?.cleanup) {
        return await deleteMessage(message.discordChannelId, message?.discordMessageId ?? '', env.DISCORD_TOKEN)
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

      const discordMessage = bodyBuilder(updatedMessage, env)
      return await updateMessage(message.discordChannelId, updatedMessage.discordMessageId, env.DISCORD_TOKEN, discordMessage)
    })
    await Promise.allSettled(updatePromises)
  }
}
