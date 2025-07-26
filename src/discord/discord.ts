import type { Stream } from '../database/db'
import { eq, tables, useDB } from '../database/db'

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
 * Builds a Discord message body for a live notification.
 * @param sub - The subscription that triggered the notification.
 * @param sub.sub - The subscrition object from the database.
 * @param sub.streamerData - The Twitch stream data for the stream. Optional.
 * @param sub.streamData - The Twitch stream data for the stream. Optional.
 * @returns A DiscordBody object containing the message to be sent.
 */
export function liveBodyBuilder({ sub, streamerData, streamData }: { sub: Stream, streamerData?: TwitchUser | null, streamData?: TwitchStream | null }) {
  const components: DiscordComponent[] = []
  const component = {
    type: 1,
    components: [
      {
        type: 2,
        label: 'Watch Stream',
        url: `https://twitch.tv/${sub.name}`,
        style: 5,
      },
    ],
  }
  components.push(component)
  const embeds: DiscordEmbed[] = []
  let title = `${streamerData?.display_name ?? sub.name} is live!`
  let thumbnail = streamerData?.offline_image_url ?? ''
  let timestamp = new Date().toISOString()

  if (streamData) {
    title = streamData.title
    thumbnail = `${streamData.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')}?b=${streamData.id}`
    timestamp = new Date(streamData.started_at).toISOString()
  }
  const embed = {
    title,
    color: 0x5865F2,
    description: `**${sub.name} is live!**`,
    fields: [
      {
        name: 'Game',
        value: streamData?.game_name ?? 'No game',
      },
    ],
    url: `https://twitch.tv/${sub.name}`,
    image: {
      url: thumbnail,
    },
    thumbnail: {
      url: streamerData ? streamerData.profile_image_url : '',
    },
    timestamp,
    footer: {
      text: 'Online',
    },
  }
  embeds.push(embed)

  const roleMention = sub.roleId && sub.roleId !== sub.guildId ? `<@&${sub.roleId}> ` : ''
  const message = `${roleMention}${messageBuilder(sub.liveMessage ? sub.liveMessage : '{{name}} is live!', sub.name, streamData?.game_name, streamData?.started_at)}`

  return {
    content: message,
    embeds,
    components,
  }
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
export function messageBuilder(message: string, streamName: string, game?: string, startedAt?: string) {
  return message.replace(/\{\{name\}\}/gi, streamName)
    .replace(/\{\{url\}\}/gi, `https://twitch.tv/${streamName}`)
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
