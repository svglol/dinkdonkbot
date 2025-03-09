import { eq, tables, useDB } from '../database/db'
import { sendMessage } from '../discord/discord'
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

    const clipPromises = clips.map(async (clip) => {
      const twitchClips = await getClipsLastHour(clip.broadcasterId, env)

      if (twitchClips) {
        for (const twitchClip of twitchClips.data) {
          const clipContent = `🚨New clip from **[${clip.streamer}](<https://www.twitch.tv/${clip.streamer}>)** 🚨\n${twitchClip.url}?`
          const body = { content: clipContent }
          await sendMessage(clip.channelId, env.DISCORD_TOKEN, body, env)
        }
      }
    })

    await Promise.all(clipPromises)
    return true
  }
  catch (error) {
    console.error('Error running scheduled twitch clips function:', error)
    return false
  }
}

/**
 * This function is called once a day by the scheduler.
 * It checks if the bot is subscribed to any servers it shouldn't be,
 * and if so, removes the subscriptions from the database and unsubscribes
 * from Twitch EventSub.
 * It also checks if Twitch EventSub is subscribed to all of our streams in the database,
 * and if not, subscribes to them.
 * @param env The environment variables for accessing configuration and services.
 * @returns A promise that resolves to true if the check was successful, or false if there was an error.
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
    return true
  }
  catch (error) {
    console.error('Error running scheduled check:', error)
    return false
  }
}
