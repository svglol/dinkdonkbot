import type { Stream } from '../database/db'
import { useDB } from '../database/db'
import { messageBuilder, sendMessage, updateMessage } from '../discord/discord'
import { getKickChannel, getKickLivestream, getKickUser, kickUnsubscribe } from './kick'

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
async function streamOnline(payload: KickLivestreamStatusUpdatedEvent, env: Env) {
  const broadcasterId = payload.broadcaster.user_id

  const subscriptions = await useDB(env).query.kickStreams.findMany({
    where: (kickStreams, { eq }) => eq(kickStreams.broadcasterId, broadcasterId.toString()),
  })

  // send message to all subscriptions
  if (subscriptions.length > 0) {
    const [kickUser, kickLivestream] = await Promise.all([
      await getKickUser(payload.broadcaster.user_id, env),
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

async function streamOffline(payload: KickLivestreamStatusUpdatedEvent, env: Env) {
  const broadcasterId = payload.broadcaster.user_id
  const broadcasterName = payload.broadcaster.username
  const channelInfo = await getKickChannel(payload.broadcaster.username, env)
  const messagesToUpdate = await env.KV.get(`discord-messages-kick-${broadcasterId}`, { type: 'json' }) as KVDiscordMessage
  if (messagesToUpdate) {
    const updatePromises = messagesToUpdate.messages.map(async (message) => {
      // update embed with offline message
      const duration = new Date(payload.ended_at).getTime() - new Date(payload.started_at).getTime()
      message.embed.timestamp = new Date(payload.ended_at).toISOString()
      message.embed.description = `Streamed for **${duration}**`
      if (message.embed.footer)
        message.embed.footer.text = 'Last online'

      if (channelInfo && channelInfo.banner_picture && message.embed.image)
        message.embed.image.url = channelInfo.banner_picture
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

export function kickLiveBodyBuilder({ sub, streamerData, streamData, eventData }: { sub: Stream, streamerData?: KickUser | null, streamData?: KickLiveStream | null, eventData?: KickLivestreamStatusUpdatedEvent | null }) {
  const components: DiscordComponent[] = []
  const component = {
    type: 1,
    components: [
      {
        type: 2,
        label: 'Watch Stream',
        url: `https://kick.com/${sub.name}`,
        style: 5,
      },
    ],
  }
  components.push(component)
  const embeds: DiscordEmbed[] = []
  let title = `${streamerData?.name ?? sub.name} is live!`
  let thumbnail = streamerData?.profile_picture ?? ''
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
      url: streamerData ? streamerData.profile_picture : '',
    },
    timestamp,
    footer: {
      text: 'Online',
    },
  }
  embeds.push(embed)

  const roleMention = sub.roleId && sub.roleId !== sub.guildId ? `<@&${sub.roleId}> ` : ''
  const message = `${roleMention}${messageBuilder(sub.liveMessage ? sub.liveMessage : '{{name}} is live!', sub.name, streamData?.category.name, streamData?.started_at)}`

  return {
    content: message,
    embeds,
    components,
  }
}
