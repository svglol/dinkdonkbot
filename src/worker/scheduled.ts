import { inArray, not } from 'drizzle-orm'
import { eq, tables, useDB } from '../database/db'
import { sendMessage } from '../discord/discord'
import { getKickSubscriptions, kickSubscribe, kickUnsubscribe } from '../kick/kick'
import { getClipsLastHour, getSubscriptions, removeFailedSubscriptions, removeSubscription, subscribe } from '../twitch/twitch'

export default {
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    switch (event.cron) {
      case '0 0 * * *':
        ctx.waitUntil(scheduledCheck(env))
        break
      case '0 * * * *':
        ctx.waitUntil(scheduledTwitchClips(env))
        break
    }
  },
}

/**
 * This function is scheduled to run every hour and fetches the latest Twitch clips
 * from the past hour for all subscribed streamers. It sends a notification to the
 * corresponding Discord channels if new clips are found.
 *
 * @param env The environment variables for accessing configuration and services.
 * @returns A promise that resolves to true once all notifications have been processed.
 */

async function scheduledTwitchClips(env: Env) {
  try {
    const clips = await useDB(env).query.clips.findMany()

    const uniqueBroadcasterIds = Array.from(new Set(clips.map(clip => clip.broadcasterId)))
    const twitchClipsPromises = uniqueBroadcasterIds.map(async (broadcasterId) => {
      return { broadcasterId, clips: await getClipsLastHour(broadcasterId, env) }
    })
    const clipsData = await Promise.all(twitchClipsPromises)
    const twitchClips = new Map(clipsData.map(({ broadcasterId, clips }) => [broadcasterId, clips]))

    for (const clip of clips) {
      if (twitchClips.has(clip.broadcasterId)) {
        for (const twitchClip of twitchClips.get(clip.broadcasterId)!.data) {
          const createdDate = new Date(twitchClip.created_at)
          const unixTimestamp = Math.floor(createdDate.getTime() / 1000)
          const removeEmojis = (str: string) => str.replace(/[^\w\s.,!?'\-":;()&%$#@]/g, '')
          const clipInfo = [
            `<a:CLIPPERS:1357111588644982997> [**${twitchClip.broadcaster_name} - ${removeEmojis(twitchClip.title)}**](${twitchClip.url}??)`,
            `*Created By:* \`${twitchClip.creator_name}\``,
            `*Created At:* <t:${unixTimestamp}:F>`,
          ].join('\n')
          const body = { content: clipInfo }
          await sendMessage(clip.channelId, env.DISCORD_TOKEN, body, env)
        }
      }
    }
    return true
  }
  catch (error) {
    console.error('Error running scheduled twitch clips function:', error)
    return false
  }
}

/**
 * This function is scheduled to run every day and performs various checks and maintenance
 * tasks to ensure the bot is functioning correctly.
 *
 * It checks if the bot is subscribed to any servers it shouldnt be and removes those subscriptions.
 * It also checks if the bot is subscribed to all of the streams in the database and
 * subscribes to any that it is not. It then checks if the bot is subscribed to any channels
 * it shouldnt be and removes those subscriptions.
 *
 * @param env The environment variables for accessing configuration and services.
 * @returns A promise that resolves to true if all checks and maintenance tasks were successful.
 */
async function scheduledCheck(env: Env) {
  try {
    const streams = await useDB(env).select().from(tables.streams)
    const clips = await useDB(env).select().from(tables.clips)

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
      const streamsToRemove = streams.filter(stream => !serverIds.includes(stream.guildId))
      const clipsToDelete = clips.filter(clip => !serverIds.includes(clip.guildId))

      const deleteClips = clipsToDelete.map(async (clip) => {
        await useDB(env).delete(tables.clips).where(eq(tables.clips.id, clip.id))
      })
      await Promise.all(deleteClips)

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

    // Kick EventSub
    const kickSubscriptions = await getKickSubscriptions(env)
    // Check if kick event sub is subscribed to all of our streams in the database
    if (kickSubscriptions) {
      const kickStreamIds = kickSubscriptions.data.map(sub => sub.broadcaster_user_id.toString())
      const kickStreams = await useDB(env)
        .select()
        .from(tables.kickStreams)
        .where(not(inArray(tables.kickStreams.broadcasterId, kickStreamIds)))

      const kickSubscriptionsPromises = kickStreams.map(async (kickStream) => {
        await kickSubscribe(Number(kickStream.broadcasterId), env)
      })
      await Promise.all(kickSubscriptionsPromises)

      // check if the bot is subscribed to any channels it shouldnt be
      const dbBroadcasterIds = await useDB(env).query.kickStreams.findMany().then(streams => streams.map(stream => stream.broadcasterId))
      const extraSubscriptions = kickSubscriptions.data.filter(sub =>
        !dbBroadcasterIds.includes(sub.broadcaster_user_id.toString()),
      )

      const unsubscribePromises = extraSubscriptions.map(sub =>
        kickUnsubscribe(Number(sub.broadcaster_user_id), env),
      )

      await Promise.all(unsubscribePromises)
    }

    // Clean up any discord messages for kick/twitch that are older than 48h
    const twitchMesagesToDelete = await useDB(env).query.twitchStreamMessages.findMany({
      where: (twitchStreamMessages, { sql }) => sql`created_at < ${sql`datetime('now', '-48 hours')`}`,
    })

    const kickMessagesToDelete = await useDB(env).query.kickStreamMessages.findMany({
      where: (kickStreamMessages, { sql }) => sql`created_at < ${sql`datetime('now', '-48 hours')`}`,
    })

    useDB(env).transaction(async (tx) => {
      await Promise.all(kickMessagesToDelete.map(async (message) => {
        await tx.delete(tables.kickStreamMessages).where(eq(tables.kickStreamMessages.id, message.id))
      }))

      await Promise.all(twitchMesagesToDelete.map(async (message) => {
        await tx.delete(tables.twitchStreamMessages).where(eq(tables.twitchStreamMessages.id, message.id))
      }))
    })

    return true
  }
  catch (error) {
    console.error('Error running scheduled check:', error)
    return false
  }
}
