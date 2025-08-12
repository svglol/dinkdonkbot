import type { StreamMessage } from '../database/db'
import { eq, tables, useDB } from '../database/db'
import { formatDuration } from '../util/formatDuration'

/**
 * Sends a message to the specified channel.
 *
 * @param channelId The id of the channel to send the message to.
 * @param discordToken The Discord bot token.
 * @param body The message body.
 * @returns The id of the message sent.
 *
 * @throws If there is an error sending the message.
 */
export async function sendMessage(channelId: string, discordToken: string, body: DiscordBody, env: Env) {
  const url = `https://discord.com/api/channels/${channelId}/messages`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${discordToken}`,
      },
      body: JSON.stringify(body),
    })

    if (await handleRateLimit(response)) {
      return sendMessage(channelId, discordToken, body, env)
    }
    // channel not found or no permissions
    else if (response.status === 404 || response.status === 403) {
      await useDB(env).delete(tables.streams).where(eq(tables.streams.channelId, channelId))
      await useDB(env).delete(tables.clips).where(eq(tables.clips.channelId, channelId))
      await useDB(env).delete(tables.kickStreams).where(eq(tables.kickStreams.channelId, channelId))
      return null
    }

    if (!response.ok) {
      throw new Error(`Failed to send message: ${await response.text()}`)
    }

    const data = await response.json() as { id: string }
    return data.id
  }
  catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}

/**
 * Updates a message in a specified channel.
 *
 * @param channelId The ID of the channel where the message is located.
 * @param messageId The ID of the message to be updated.
 * @param discordToken The Discord bot token for authorization.
 * @param body The new content of the message as a DiscordBody object.
 * @returns The ID of the updated message.
 *
 * @throws If there is an error updating the message.
 */

export async function updateMessage(channelId: string, messageId: string, discordToken: string, body: DiscordBody) {
  const url = `https://discord.com/api/channels/${channelId}/messages/${messageId}`

  try {
    const message = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${discordToken}`,
      },
      body: JSON.stringify(body),
    })

    if (await handleRateLimit(message)) {
      return updateMessage(channelId, messageId, discordToken, body)
    }

    if (!message.ok)
      throw new Error(`Failed to update message: ${await message.text()}`)

    const data = await message.json() as { id: string }
    return data.id
  }
  catch (error) {
    console.error('Error sending message:', error)
  }
}

/**
 * Updates the original response message for a Discord interaction.
 *
 * @param interaction The interaction object containing the token to identify the interaction.
 * @param discordApplicationId The ID of the Discord application.
 * @param body The new content of the message as a DiscordBody object.
 * @throws If there is an error updating the interaction.
 */

export async function updateInteraction(interaction: DiscordInteraction, dicordApplicationId: string, body: DiscordBody) {
  try {
    const defer = await fetch(`https://discord.com/api/v10/webhooks/${dicordApplicationId}/${interaction.token}/messages/@original`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (await handleRateLimit(defer)) {
      return updateInteraction(interaction, dicordApplicationId, body)
    }

    if (!defer.ok)
      throw new Error(`Failed to update interaction: ${await defer.text()}`)
  }
  catch (error) {
    console.error('Error updating interaction:', error)
  }
}

/**
 * Uploads a new emoji to the specified guild.
 *
 * @param guildId The ID of the guild to which the emoji should be uploaded.
 * @param discordToken The Discord bot token for authorization.
 * @param emojiName The desired name for the emoji.
 * @param imageBuffer The image data for the emoji as a Buffer.
 * @returns A DiscordEmoji object containing the ID of the uploaded emoji.
 *
 * @throws If there is an error uploading the emoji.
 */
// eslint-disable-next-line node/prefer-global/buffer
export async function uploadEmoji(guildId: string, discordToken: string, emojiName: string, imageBuffer: Buffer) {
  const url = `https://discord.com/api/guilds/${guildId}/emojis`

  const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bot ${discordToken}`,
    },
    body: JSON.stringify({
      name: emojiName,
      image: base64Image,
    }),
  })

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(`The bot does not have permission to upload emojis to this server.`)
    }
    else if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '1'
      const resetTimestamp = Number.parseInt(retryAfter, 10)
      const resetDate = new Date(Date.now() + resetTimestamp * 1000)
      throw new Error(`Rate limit exceeded. Please try again after ${resetDate.toUTCString()} (${resetTimestamp} seconds).`)
    }
    throw new Error(`Failed to upload emoji - ${await response.text()}`)
  }

  const data = await response.json() as { id: string }
  return data
}

/**
 * Replaces placeholders in a message with actual values.
 *
 * Replaces the following placeholders:
 *
 * - `{{name}}` with the streamer's name
 * - `{{url}}` with a link to the streamer's channel
 * - `{{everyone}}` with a mention of the `@everyone` role
 * - `{{here}}` with a mention of the `@here` role
 * - `{{game}}` or `{{category}}` with the game/category the streamer is playing (if provided)
 * - `{{timestamp}}` with a timestamp of when the stream started (if provided)
 *
 * @param message - The message with placeholders to be replaced.
 * @param streamName - The name of the streamer.
 * @param game - The game/category the streamer is playing (optional).
 * @param startedAt - The timestamp of when the stream started (optional).
 * @returns The message with all placeholders replaced.
 */
export function messageBuilder(message: string, streamName: string, game?: string, startedAt?: string, service: 'twitch' | 'kick' | 'both' = 'twitch') {
  const twitchUrl = `https://twitch.tv/${streamName}`
  const kickUrl = `https://kick.com/${streamName}`

  let urlReplacement: string

  switch (service) {
    case 'kick':
      urlReplacement = kickUrl
      break
    case 'both':
      urlReplacement = `${twitchUrl} | ${kickUrl}`
      break
    case 'twitch':
    default:
      urlReplacement = twitchUrl
      break
  }

  return message.replace(/\{\{name\}\}/gi, streamName)
    .replace(/\{\{url\}\}/gi, urlReplacement)
    .replace(/\{\{twitch_url\}\}/gi, twitchUrl)
    .replace(/\{\{kick_url\}\}/gi, kickUrl)
    .replace(/\{\{everyone\}\}/gi, '@everyone')
    .replace(/\{\{here\}\}/gi, '@here')
    .replace(/\{\{(game|category)\}\}/gi, game || '')
    .replace(/\{\{timestamp\}\}/gi, `<t:${startedAt ? Math.floor(new Date(startedAt).getTime() / 1000) : Math.floor(new Date().getTime() / 1000)}:R>`)
}

/**
 * Handles a rate limit response by waiting the specified amount of time before retrying.
 *
 * If the response is a 429 status code, this function will wait the specified amount of time
 * before returning true. If the response is not a 429 status code, this function will return
 * false.
 *
 * @param response The response to check for rate limiting.
 * @returns True if the response was a 429 and the function waited, false otherwise.
 */
async function handleRateLimit(response: Response) {
  if (response.status === 429) {
    const rateLimitData = await response.json() as { retry_after: number }
    await new Promise(resolve => setTimeout(resolve, rateLimitData.retry_after * 1000 + 100))
    return true
  }
  return false
}

/**
 * Checks if the bot has permission to post in the specified channel.
 *
 * @param channelId - The ID of the channel to check.
 * @param discordToken - The bot token for authorization.
 * @param env - The environment object.
 * @returns True if the bot has permission to post in the channel, false otherwise.
 */
export async function checkChannelPermission(channelId: string, discordToken: string, env: Env) {
  const url = `https://discord.com/api/channels/${channelId}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bot ${discordToken}`,
      },
    })

    if (await handleRateLimit(response)) {
      return checkChannelPermission(channelId, discordToken, env)
    }

    return response.ok
  }
  catch (error) {
    console.error('Error checking channel permission:', error)
    return false
  }
}

/**
 * Fetches all custom emojis for a guild.
 *
 * @param guildId - The ID of the guild to fetch emojis from.
 * @param discordToken - The bot token for authorization.
 * @returns An array of DiscordEmoji objects, each containing the ID and name of the emoji.
 *
 * @throws If there is an error fetching the emojis.
 */
export async function fetchGuildEmojis(guildId: string, discordToken: string) {
  const url = `https://discord.com/api/v10/guilds/${guildId}/emojis`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bot ${discordToken}`,
    },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch guild emojis: ${await response.text()}`)
  }

  return await response.json() as DiscordEmoji[]
}

/**
 * Builds a Discord message body based on the given StreamMessage data.
 *
 * @param streamMessage - The StreamMessage data to build a message body from.
 * @param env - The environment variables for accessing configuration and services.
 * @returns An object containing the body of the message, any embeds, and any components.
 */
export function bodyBuilder(streamMessage: StreamMessage, env: Env) {
  if (!streamMessage)
    return { content: '', embeds: [], components: [] }

  const components: DiscordComponent[] = []
  const embeds: DiscordEmbed[] = []
  let content = ''

  // build components
  const buttons: DiscordComponentData[] = []
  if (streamMessage?.stream) {
    if (streamMessage.twitchOnline) {
      buttons.push({
        type: 2,
        label: 'Watch Twitch Stream',
        url: `https://twitch.tv/${streamMessage.stream.name}`,
        style: 5,
        emoji: {
          name: 'twitch',
          id: '1404659206170083388',
          animated: false,
        },
      })
    }
    else if (streamMessage.twitchVod) {
      buttons.push({
        type: 2,
        label: 'Watch Twitch VOD',
        url: `https://twitch.tv/videos/${streamMessage.twitchVod?.id}`,
        style: 5,
        emoji: {
          name: 'twitch',
          id: '1404659206170083388',
          animated: false,
        },
      })
    }
  }

  if (streamMessage?.kickStream) {
    if (streamMessage.kickOnline) {
      buttons.push({
        type: 2,
        label: 'Watch Kick Stream',
        url: `https://kick.com/${streamMessage.kickStream.name}`,
        style: 5,
        emoji: {
          name: 'kick',
          id: '1404659170179027015',
          animated: false,
        },
      })
    }
    else if (streamMessage.kickVod) {
      buttons.push({
        type: 2,
        label: 'Watch Kick VOD',
        url: `https://kick.com/${streamMessage.kickStream.name}/videos/${streamMessage.kickVod?.video.uuid}`,
        style: 5,
        emoji: {
          name: 'kick',
          id: '1404659170179027015',
          animated: false,
        },
      })
    }
  }

  if (buttons.length > 0) {
    components.push({
      type: 1,
      components: buttons,
    })
  }

  // build embeds
  if (streamMessage?.stream) {
    if (streamMessage.twitchOnline) {
      // online embed
      let title = `${streamMessage.twitchStreamerData?.display_name ?? streamMessage.stream.name} is live!`
      let thumbnail = streamMessage.twitchStreamerData?.offline_image_url ?? ''
      let timestamp = new Date().toISOString()

      if (streamMessage.twitchStreamData) {
        title = streamMessage.twitchStreamData.title
        thumbnail = `${streamMessage.twitchStreamData.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')}?b=${streamMessage.twitchStreamData.id}`
        timestamp = new Date(streamMessage.twitchStreamData.started_at).toISOString()
      }

      const embed = {
        title,
        color: 0x6441A4,
        description: `**${streamMessage.stream.name} is live!**`,
        author: {
          name: 'Live on Twitch',
          icon_url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/twitch-logo.png` : undefined,
        },
        fields: [
          {
            name: 'Game',
            value: streamMessage.twitchStreamData?.game_name ?? 'No game',
          },
        ],
        url: `https://twitch.tv/${streamMessage.stream.name}`,
        image: {
          url: thumbnail,
        },
        thumbnail: {
          url: streamMessage.twitchStreamerData ? streamMessage.twitchStreamerData.profile_image_url : '',
        },
        timestamp,
        footer: {
          text: 'Online',
        },
      }

      embeds.push(embed)
    }
    else {
      // offline embed
      const duration = streamMessage.twitchVod
        ? streamMessage.twitchVod.duration
        : streamMessage.twitchStreamEndedAt && streamMessage.twitchStreamStartedAt
          ? formatDuration(streamMessage.twitchStreamEndedAt.getTime() - streamMessage.twitchStreamStartedAt.getTime())
          : '0'
      const timestamp = streamMessage.twitchStreamEndedAt?.toISOString()
      const backupImage = streamMessage.twitchStreamData ? `${streamMessage.twitchStreamData.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')}?b=${streamMessage.twitchStreamData.id}` : ''
      let title = `${streamMessage.twitchStreamerData?.display_name ?? streamMessage.stream.name} is no longer live!`
      if (streamMessage.twitchStreamData) {
        title = streamMessage.twitchStreamData.title
      }
      const embed = {
        title,
        color: 0x6441A4,
        description: `Streamed for **${duration}**`,
        author: {
          name: 'Twitch',
          icon_url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/twitch-logo.png` : undefined,
        },
        url: `https://twitch.tv/${streamMessage.stream.name}`,
        image: {
          url: streamMessage.twitchStreamerData?.offline_image_url ? streamMessage.twitchStreamerData.offline_image_url : backupImage,
        },
        thumbnail: {
          url: streamMessage.twitchStreamerData ? streamMessage.twitchStreamerData.profile_image_url : '',
        },
        timestamp,
        footer: {
          text: 'Last online',
        },
      }

      embeds.push(embed)
    }
  }
  if (streamMessage?.kickStream) {
    if (streamMessage.kickOnline) {
      // online embed
      let title = `${streamMessage.kickStreamerData?.slug ?? streamMessage.kickStream.name} is live!`
      let thumbnail = streamMessage.kickStreamerData?.offline_banner_image?.src || 'https://kick.com/img/default-channel-banners/offline.webp'
      let timestamp = new Date().toISOString()
      if (streamMessage.kickStreamData) {
        title = streamMessage.kickStreamData.stream_title
        thumbnail = `${streamMessage.kickStreamData.thumbnail}?b=${streamMessage.kickStreamData.started_at}`
        timestamp = new Date(streamMessage.kickStreamData.started_at).toISOString()
      }
      const embed = {
        title,
        color: 0x53FC18,
        description: `**${streamMessage.kickStream.name} is live!**`,
        author: {
          name: 'Live on KICK',
          icon_url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/kick-logo.png` : undefined,
        },
        fields: [
          {
            name: 'Game',
            value: streamMessage.kickStreamData?.category.name ?? 'No game',
          },
        ],
        url: `https://kick.com/${streamMessage.kickStream.name}`,
        image: {
          url: thumbnail,
        },
        thumbnail: {
          url: streamMessage.kickStreamerData?.user.profile_pic ?? '',
        },
        timestamp,
        footer: {
          text: 'Online',
        },
      }
      embeds.push(embed)
    }
    else {
      // offline embed
      const duration = streamMessage.kickVod
        ? formatDuration(streamMessage.kickVod.duration)
        : streamMessage.kickStreamEndedAt && streamMessage.kickStreamStartedAt
          ? formatDuration(streamMessage.kickStreamEndedAt.getTime() - streamMessage.kickStreamStartedAt.getTime())
          : '0'
      const timestamp = streamMessage.kickStreamEndedAt?.toISOString()
      let title = `${streamMessage.kickStreamerData?.user.username ?? streamMessage.kickStream.name} is no longer live!`
      if (streamMessage.kickStreamData) {
        title = streamMessage.kickStreamData.stream_title
      }
      const embed = {
        title,
        color: 0x53FC18,
        description: `Streamed for **${duration}**`,
        author: {
          name: 'Kick',
          icon_url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/kick-logo.png` : undefined,
        },
        url: `https://kick.com/${streamMessage.kickStream.name}`,
        image: {
          url: streamMessage.kickStreamerData?.offline_banner_image?.src || 'https://kick.com/img/default-channel-banners/offline.webp',
        },
        thumbnail: {
          url: streamMessage.kickStreamerData ? streamMessage.kickStreamerData.user.profile_pic : '',
        },
        timestamp,
        footer: {
          text: 'Last online',
        },
      }
      embeds.push(embed)
    }
  }

  // build content message
  if (streamMessage?.stream) {
    if (streamMessage.twitchOnline) {
      const roleMention = streamMessage.stream.roleId && streamMessage.stream.roleId !== streamMessage.stream.guildId ? `<@&${streamMessage.stream.roleId}> ` : ''
      const message = `${roleMention}${messageBuilder(streamMessage.stream.liveMessage ? streamMessage.stream.liveMessage : '{{name}} is live!', streamMessage.stream.name, streamMessage.twitchStreamData?.game_name, streamMessage.twitchStreamData?.started_at)}`
      content = message
    }
    else {
      const offlineMessage = messageBuilder(streamMessage.stream.offlineMessage ? streamMessage.stream.offlineMessage : '{{name}} is now offline.', streamMessage.stream.name)
      content = offlineMessage
    }
  }
  if (streamMessage?.kickStream) {
    if (streamMessage.kickOnline) {
      const roleMention = streamMessage.kickStream.roleId && streamMessage.kickStream.roleId !== streamMessage.kickStream.guildId ? `<@&${streamMessage.kickStream.roleId}> ` : ''
      const message = `${roleMention}${messageBuilder(streamMessage.kickStream.liveMessage ? streamMessage.kickStream.liveMessage : '{{name}} is live!', streamMessage.kickStream.name, streamMessage.kickStreamData?.category.name, streamMessage.kickStreamData?.started_at, 'kick')}`

      if (content !== '') {
        content += '\n'
      }
      content += message
    }
    else {
      const offlineMessage = messageBuilder(streamMessage.kickStream?.offlineMessage ? streamMessage.kickStream?.offlineMessage : '{{name}} is now offline.', streamMessage.kickStream.name)

      if (content && content !== offlineMessage) {
        content += `\n${offlineMessage}`
      }
      else if (!content) {
        content = offlineMessage
      }
    }
  }

  if (streamMessage?.stream && streamMessage?.kickStream && streamMessage.twitchOnline && streamMessage.kickOnline) {
    // combined online message
    const roleMention = streamMessage.stream.roleId && streamMessage.stream.roleId !== streamMessage.stream.guildId ? `<@&${streamMessage.stream.roleId}> ` : ''
    const kickRoleMention = streamMessage.kickStream.roleId && streamMessage.kickStream.roleId !== streamMessage.kickStream.guildId ? `<@&${streamMessage.kickStream.roleId}> ` : ''

    if (streamMessage.stream.liveMessage === streamMessage.kickStream.liveMessage) {
      // we can combine the messages
      content = [roleMention, kickRoleMention, messageBuilder(
        streamMessage.stream.liveMessage ? streamMessage.stream.liveMessage : '@everyone {{name}} is now live @ {{url}}',
        streamMessage.stream.name,
        streamMessage.twitchStreamData?.game_name,
        streamMessage.twitchStreamData?.started_at,
        'both',
      )].filter(Boolean).join(' ')
    }
  }
  if (streamMessage?.stream && streamMessage?.kickStream && !streamMessage.twitchOnline && !streamMessage.kickOnline) {
    // combined offline message
    const twitchOfflineMessage = messageBuilder(streamMessage.stream.offlineMessage ? streamMessage.stream.offlineMessage : '{{name}} is now offline.', streamMessage.stream.name)
    const kickOfflineMessage = messageBuilder(streamMessage.kickStream?.offlineMessage ? streamMessage.kickStream?.offlineMessage : '{{name}} is now offline.', streamMessage.kickStream.name)
    if (twitchOfflineMessage === kickOfflineMessage) {
      content = twitchOfflineMessage
    }
  }

  return {
    content,
    embeds,
    components,
  }
}
