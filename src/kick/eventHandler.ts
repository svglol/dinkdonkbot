import type { ChannelState } from '../durable/ChannelState'
import { and, eq, tables, useDB } from '../database/db'
import { bodyBuilder, deleteMessage, updateMessage } from '../discord/discord'
import { getKickLatestVod } from './kick'

/**
 * Handles a 'livestream.status.updated' event by sending a live message to all subscribers.
 *
 * @param eventType - The type of the event. Must be 'livestream.status.updated'.
 * @param payload - The payload containing the event data and subscription details.
 * @param env - The environment variables for accessing configuration and services.
 */
export async function kickEventHandler(eventType: string, payload: KickLivestreamStatusUpdatedEvent, env: Env, ctx: ExecutionContext) {
  if (eventType !== 'livestream.status.updated') {
    throw new Error(`Invalid event type: ${eventType}`)
  }

  if (payload.is_live && payload.ended_at === null) {
    ctx.waitUntil(streamOnline(payload, env))
  }
  else {
    ctx.waitUntil(streamOffline(payload, env))
  }
}

/**
 * Handles a 'livestream.status.updated' event with 'is_live' set to true by sending a live message to all subscribers.
 *
 * @param payload - The payload containing the event data and subscription details.
 * @param env - The environment variables for accessing configuration and services.
 */
async function streamOnline(payload: KickLivestreamStatusUpdatedEvent, env: Env) {
  const broadcasterName = payload.broadcaster.channel_slug

  const durableObjectId = env.CHANNELSTATE.idFromName(broadcasterName.toLowerCase())
  const durableObject: DurableObjectStub<ChannelState> = env.CHANNELSTATE.get(durableObjectId)
  return await durableObject.handleStream({ platform: 'kick', payload })
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
  const latestVOD = await getKickLatestVod(broadcasterName)

  // get any stream messages with this kick broadcaster id that need to be updated
  const streamMessages = await useDB(env).query.streamMessages.findMany({
    with: {
      stream: true,
      kickStream: true,
    },
    where: (messages, { eq, and }) => and(eq(messages.kickOnline, true), eq(messages.kickStreamStartedAt, new Date(payload.started_at))),
  })

  const filteredStreamMessages = streamMessages.filter(message => message.kickStream?.broadcasterId === broadcasterId.toString())

  if (filteredStreamMessages.length > 0) {
    // these are the stream messages that need to be updated

    const promises = filteredStreamMessages.map(async (message) => {
      // first we will update the database entry
      const updatedMessage = await useDB(env).update(tables.streamMessages).set({
        kickOnline: false,
        kickStreamEndedAt: new Date(payload.ended_at),
        kickVod: latestVOD,
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
      if (discordMessage.embeds.length > 0) {
        return await updateMessage(message.discordChannelId, message?.discordMessageId ?? '', env.DISCORD_TOKEN, discordMessage)
      }
      else if (message?.kickStream?.cleanup) {
        return await deleteMessage(message.discordChannelId, message?.discordMessageId ?? '', env.DISCORD_TOKEN)
      }
    })
    await Promise.allSettled(promises)

    // delete any stream messages that are no longer live on both kick and twitch (these are no longer needed)
    await useDB(env).delete(tables.streamMessages).where(and(eq(tables.streamMessages.kickOnline, false), eq(tables.streamMessages.twitchOnline, false)))
  }
}
