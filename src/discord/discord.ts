import type { APIButtonComponent, APIEmbed, APIInteraction, APIMessage, APIMessageTopLevelComponent, RESTGetAPIApplicationCommandsResult, RESTGetAPIChannelResult, RESTGetAPIGuildEmojisResult, RESTPatchAPIChannelMessageJSONBody, RESTPatchAPIChannelMessageResult, RESTPostAPIChannelMessageJSONBody, RESTPostAPIChannelMessageResult, RESTPostAPIGuildEmojiResult, RESTPostAPIGuildStickerResult } from 'discord-api-types/v10'
import type { StreamMessage } from '../database/db'
import { DiscordAPIError, REST } from '@discordjs/rest'

import { Routes } from 'discord-api-types/v10'

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
export async function sendMessage(channelId: string, discordToken: string, body: RESTPostAPIChannelMessageJSONBody, env: Env) {
  try {
    const rest = new REST({ version: '10', makeRequest: fetch.bind(globalThis) as any }).setToken(discordToken)
    const message = await rest.post(Routes.channelMessages(channelId), {
      body,
    }) as RESTPostAPIChannelMessageResult

    return message.id
  }
  catch (error: DiscordAPIError | unknown) {
    console.error('Error sending message:', error)
    if (error instanceof DiscordAPIError) {
      // If the channel isnt found or the bot doesn't have permission to post in the channel
      if (error.status === 404 || error.status === 403) {
        await useDB(env).delete(tables.streams).where(eq(tables.streams.channelId, channelId))
        await useDB(env).delete(tables.clips).where(eq(tables.clips.channelId, channelId))
        await useDB(env).delete(tables.kickStreams).where(eq(tables.kickStreams.channelId, channelId))
        return null
      }
    }
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
export async function updateMessage(channelId: string, messageId: string, discordToken: string, body: RESTPatchAPIChannelMessageJSONBody) {
  try {
    const rest = new REST({ version: '10', makeRequest: fetch.bind(globalThis) as any }).setToken(discordToken)
    const message = await rest.patch(Routes.channelMessage(channelId, messageId), {
      body,
    }) as RESTPatchAPIChannelMessageResult

    return message.id
  }
  catch (error: unknown) {
    console.error('Failed to update message:', error)
  }
}

/**
 * Deletes a message in a specified channel.
 *
 * @param channelId The ID of the channel where the message is located.
 * @param messageId The ID of the message to be deleted.
 * @param discordToken The Discord bot token for authorization.
 *
 * @throws If there is an error deleting the message.
 */
export async function deleteMessage(channelId: string, messageId: string, discordToken: string) {
  try {
    const rest = new REST({ version: '10', makeRequest: fetch.bind(globalThis) as any }).setToken(discordToken)
    await rest.delete(Routes.channelMessage(channelId, messageId))
  }
  catch (error: unknown) {
    console.error('Failed to delete message:', error)
  }
}

/**
 * Updates the original response message for a Discord interaction.
 *
 * @param interaction The interaction object containing the token to identify the interaction.
 * @param dicordApplicationId The ID of the Discord application.
 * @param body The new content of the message as a DiscordBody object.
 * @throws If there is an error updating the interaction.
 */
export async function updateInteraction(interaction: APIInteraction, dicordApplicationId: string, body: RESTPatchAPIChannelMessageJSONBody) {
  try {
    const rest = new REST({ version: '10', makeRequest: fetch.bind(globalThis) as any }).setToken(interaction.token)
    const updatedInteraction = await rest.patch(Routes.webhookMessage(dicordApplicationId, interaction.token, '@original'), {
      body,
    }) as APIMessage

    return updatedInteraction
  }
  catch (error: unknown) {
    console.error('Failed to update interaction:', error)
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
  try {
    const rest = new REST({ version: '10', makeRequest: fetch.bind(globalThis) as any }).setToken(discordToken)
    const emoji = await rest.post(Routes.guildEmojis(guildId), {
      body: {
        name: emojiName,
        image: `data:image/png;base64,${imageBuffer.toString('base64')}`,
      },
    }) as RESTPostAPIGuildEmojiResult

    return emoji
  }
  catch (error: unknown | DiscordAPIError) {
    if (error instanceof DiscordAPIError) {
      switch (error.status) {
        case 400:
          if (error.code === 30008) {
            throw new Error(`Maximum number of emojis reached.`)
          }
          if (error.code === 30018) {
            throw new Error(`Maximum number of animated emojis reached.`)
          }
          break
        case 403:
          if (error.code === 50013) {
            throw new Error(`The bot does not have permission to upload emojis to this server.`)
          }
          break
        case 429:
          throw new Error(`You have reached the rate limit for uploading emojis, Discord only allows 50 emote uploads per hour.`)
      }
    }
    throw new Error(`Failed to upload emoji- ${error}`)
  }
}

// eslint-disable-next-line node/prefer-global/buffer
export async function uploadSticker(guildId: string, discordToken: string, stickerName: string, imageBuffer: Buffer<ArrayBufferLike>, imageExtension: string, description = 'stolen sticker', tags = 'stolen') {
  try {
    const form = new FormData()
    form.append('name', stickerName)
    form.append('description', description)
    form.append('tags', tags)
    const file = new File([imageBuffer], `${stickerName}.${imageExtension}`, {
      type: `image/${imageExtension}`,
    })
    form.append('file', file)

    const rest = new REST({ version: '10', makeRequest: fetch.bind(globalThis) as any }).setToken(discordToken)
    const sticker = await rest.post(Routes.guildStickers(guildId), {
      body: form,
      passThroughBody: true,
    }) as RESTPostAPIGuildStickerResult

    return sticker
  }
  catch (error: any | DiscordAPIError) {
    if (error instanceof DiscordAPIError) {
      switch (error.status) {
        case 400:
          if (error.code === 30039) {
            throw new Error(`Maximum number of stickers reached on this server.`)
          }
          break
        case 403:
          if (error.code === 50013) {
            throw new Error(`The bot does not have permission to upload stickers to this server.`)
          }
          break
        case 429:
          throw new Error(`You have reached the rate limit for uploading stickers, Discord only allows 50 sticker uploads per hour.`)
      }
    }
    throw new Error(`Failed to upload sticker - ${error}`)
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
 * Checks if the bot has permission to post in the specified channel.
 *
 * @param channelId - The ID of the channel to check.
 * @param discordToken - The bot token for authorization.
 * @returns True if the bot has permission to post in the channel, false otherwise.
 */
export async function checkChannelPermission(channelId: string, discordToken: string) {
  try {
    const rest = new REST({ version: '10', makeRequest: fetch.bind(globalThis) as any }).setToken(discordToken)
    const channel = await rest.get(Routes.channel(channelId)) as RESTGetAPIChannelResult
    if (channel)
      return true
  }
  catch (error: unknown) {
    console.error('Error checking send message permission:', error)
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
  try {
    const rest = new REST({ version: '10', makeRequest: fetch.bind(globalThis) as any }).setToken(discordToken)
    const emojis = await rest.get(Routes.guildEmojis(guildId)) as RESTGetAPIGuildEmojisResult
    return emojis
  }
  catch (error: unknown) {
    throw new Error(`Failed to fetch guild emojis ${error}`)
  }
}

export async function fetchBotCommands(discordToken: string, env: Env) {
  try {
    const rest = new REST({ version: '10', makeRequest: fetch.bind(globalThis) as any }).setToken(discordToken)
    const commands = await rest.get(Routes.applicationCommands(env.DISCORD_APPLICATION_ID)) as RESTGetAPIApplicationCommandsResult
    return commands
  }
  catch (error: unknown) {
    console.error('Failed to fetch bot commands:', error)
    return []
  }
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

  // ! TEMP this is for testing the new body builder only for the beta server (we can remove this when its ready)
  if (streamMessage.stream?.guildId === '705928685068222496' || streamMessage.kickStream?.guildId === '705928685068222496') {
    return betaBodyBuilder(streamMessage, env)
  }

  const components: APIMessageTopLevelComponent[] = []
  const embeds: APIEmbed[] = []
  let content = ''

  // build components
  const buttons: APIButtonComponent[] = []
  if (streamMessage?.stream) {
    if (streamMessage.twitchOnline) {
      buttons.push({
        type: 2,
        label: 'Watch Twitch Stream',
        url: `https://twitch.tv/${streamMessage.stream.name}`,
        style: 5,
        emoji: {
          name: 'twitch',
          id: '1404661243373031585',
          animated: false,
        },
      })
    }
    else if (streamMessage.twitchVod && !streamMessage.stream.cleanup) {
      buttons.push({
        type: 2,
        label: 'Watch Twitch VOD',
        url: `https://twitch.tv/videos/${streamMessage.twitchVod?.id}`,
        style: 5,
        emoji: {
          name: 'twitch',
          id: '1404661243373031585',
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
          id: '1404661261030916246',
          animated: false,
        },
      })
    }
    else if (streamMessage.kickVod && !streamMessage.kickStream.cleanup) {
      buttons.push({
        type: 2,
        label: 'Watch Kick VOD',
        url: `https://kick.com/${streamMessage.kickStream.name}/videos/${streamMessage.kickVod?.video.uuid}`,
        style: 5,
        emoji: {
          name: 'kick',
          id: '1404661261030916246',
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
        thumbnail = `${streamMessage.twitchStreamData.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')}?b=${streamMessage.twitchStreamData.id}&t=${new Date().getTime()}`
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
    else if (!streamMessage.stream.cleanup) {
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
        thumbnail = `${streamMessage.kickStreamData.thumbnail}?b=${streamMessage.kickStreamData.started_at}&t=${new Date().getTime()}`
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
    else if (!streamMessage.kickStream.cleanup) {
      // offline embed
      const duration = streamMessage.kickVod && !Number.isNaN(streamMessage.kickVod.duration) && streamMessage.kickVod.duration > 0
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
    else if (!streamMessage.stream.cleanup) {
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
    else if (!streamMessage.kickStream.cleanup) {
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

export function betaBodyBuilder(streamMessage: StreamMessage, _env: Env): RESTPostAPIChannelMessageJSONBody {
  let message: string
  let title: string
  let color: number = 0xFFF200
  let description: string
  let game: string | undefined
  let status: string
  let timestamp: number
  let thumbnail: string
  let image: string
  let url: string
  const buttons: APIButtonComponent[] = []
  // TODO for now we ignore multi stream and just show the first stream
  // if (streamMessage.kickStream && streamMessage.stream) {
  //   // TODO handle multi stream
  //   message = 'todo'
  //   title = 'todo'
  //   color = 0x53FC18
  //   description = 'todo'
  //   game = 'todo'
  //   status = 'todo'
  //   timestamp = new Date().getTime()
  //   thumbnail = 'https://kick.com/img/default-channel-banners/offline.webp'
  //   image = 'https://kick.com/img/default-channel-banners/offline.webp'
  //   url = 'https://kick.com/'
  // }
  if (streamMessage.stream) {
    thumbnail = streamMessage.twitchStreamerData?.profile_image_url || ''
    color = 0x6441A4
    if (streamMessage.twitchOnline) {
      message = `${streamMessage.stream.roleId && streamMessage.stream.roleId !== streamMessage.stream.guildId ? `<@&${streamMessage.stream.roleId}> ` : ''}${messageBuilder(streamMessage.stream.liveMessage ? streamMessage.stream.liveMessage : '{{name}} is live!', streamMessage.stream.name, streamMessage.twitchStreamData?.game_name, streamMessage.twitchStreamData?.started_at)}`
      title = streamMessage.twitchStreamData?.title || `${streamMessage.twitchStreamerData?.display_name} is live!`
      description = `**<:twitch:1404661243373031585> ${streamMessage.twitchStreamerData?.display_name} is live on Twitch!**`
      game = streamMessage.twitchStreamData?.game_name || 'No game'
      status = 'Online'
      timestamp = Math.floor(new Date(streamMessage.twitchStreamData?.started_at || Date.now()).getTime() / 1000)
      image = streamMessage.twitchStreamData ? `${streamMessage.twitchStreamData.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')}?b=${streamMessage.twitchStreamData.id}&t=${new Date().getTime()}` : streamMessage.twitchStreamerData?.offline_image_url || ''
      url = `https://twitch.tv/${streamMessage.twitchStreamerData?.login}`

      buttons.push({
        type: 2,
        label: 'Watch Twitch Stream',
        url,
        style: 5,
        emoji: {
          name: 'twitch',
          id: '1404661243373031585',
          animated: false,
        },
      })
    }
    else {
      message = messageBuilder(streamMessage.stream.offlineMessage ? streamMessage.stream.offlineMessage : '{{name}} is now offline.', streamMessage.stream.name)
      title = `${streamMessage.twitchStreamerData?.display_name ?? streamMessage.stream.name} is no longer live!`
      const duration = streamMessage.twitchVod
        ? streamMessage.twitchVod.duration
        : streamMessage.twitchStreamEndedAt && streamMessage.twitchStreamStartedAt
          ? formatDuration(streamMessage.twitchStreamEndedAt.getTime() - streamMessage.twitchStreamStartedAt.getTime())
          : '0'
      description = `${streamMessage.twitchStreamerData?.display_name ?? streamMessage.stream.name} streamed for **${duration}**`
      status = 'Last online'
      timestamp = Math.floor(new Date(streamMessage.twitchStreamEndedAt || Date.now()).getTime() / 1000)
      const backupImage = streamMessage.twitchStreamData ? `${streamMessage.twitchStreamData.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')}?b=${streamMessage.twitchStreamData.id}` : 'https://static-cdn.jtvnw.net/jtv-static/404_preview-1920x1080.png'
      image = streamMessage.twitchStreamerData?.offline_image_url || backupImage
      url = `https://www.twitch.tv/${streamMessage.twitchStreamerData?.login}`

      if (streamMessage.twitchVod) {
        buttons.push({
          type: 2,
          label: 'Watch Twitch VOD',
          url: `https://twitch.tv/videos/${streamMessage.twitchVod.id}`,
          style: 5,
          emoji: {
            name: 'twitch',
            id: '1404661243373031585',
            animated: false,
          },
        })
      }
    }
  }
  else if (streamMessage.kickStream) {
    thumbnail = streamMessage.kickStreamerData?.user.profile_pic || ''
    color = 0x53FC18
    if (streamMessage.kickOnline) {
      const roleMention = streamMessage.kickStream.roleId && streamMessage.kickStream.roleId !== streamMessage.kickStream.guildId ? `<@&${streamMessage.kickStream.roleId}> ` : ''
      message = `${roleMention}${messageBuilder(streamMessage.kickStream.liveMessage ? streamMessage.kickStream.liveMessage : '{{name}} is live!', streamMessage.kickStream.name, streamMessage.kickStreamData?.category.name, streamMessage.kickStreamData?.started_at, 'kick')}`
      title = streamMessage.kickStreamData?.stream_title || `${streamMessage.kickStreamerData?.slug ?? streamMessage.kickStream.name} is live!`
      description = `**<:kick:1404661261030916246> ${streamMessage.kickStreamerData?.slug ?? streamMessage.kickStream.name} is live on KICK!**`
      game = streamMessage.kickStreamData?.category.name || 'No game'
      status = 'Online'
      timestamp = Math.floor(new Date(streamMessage.kickStreamData?.started_at || Date.now()).getTime() / 1000)
      image = streamMessage.kickStreamData?.thumbnail ? `${streamMessage.kickStreamData?.thumbnail}?b=${streamMessage.kickStreamData?.started_at}&t=${new Date().getTime()}` : 'https://kick.com/img/default-channel-banners/offline.webp'
      url = `https://kick.com/${streamMessage.kickStream.name}`

      buttons.push({
        type: 2,
        label: 'Watch Kick Stream',
        url,
        style: 5,
        emoji: {
          name: 'kick',
          id: '1404661261030916246',
          animated: false,
        },
      })
    }
    else {
      message = messageBuilder(streamMessage.kickStream?.offlineMessage ? streamMessage.kickStream?.offlineMessage : '{{name}} is now offline.', streamMessage.kickStream.name)
      title = `${streamMessage.kickStreamerData?.slug ?? streamMessage.kickStream.name} is no longer live!`
      const duration = streamMessage.kickVod && !Number.isNaN(streamMessage.kickVod.duration) && streamMessage.kickVod.duration > 0
        ? formatDuration(streamMessage.kickVod.duration)
        : streamMessage.kickStreamEndedAt && streamMessage.kickStreamStartedAt
          ? formatDuration(streamMessage.kickStreamEndedAt.getTime() - streamMessage.kickStreamStartedAt.getTime())
          : '0'
      description = `${streamMessage.kickStreamerData?.slug ?? streamMessage.kickStream.name} streamed for **${duration}**`
      status = 'Last online'
      timestamp = Math.floor(new Date(streamMessage.kickStreamEndedAt || Date.now()).getTime() / 1000)
      image = streamMessage.kickStreamerData?.offline_banner_image?.src || 'https://kick.com/img/default-channel-banners/offline.webp'
      url = `https://kick.com/${streamMessage.kickStream.name}`
      if (streamMessage.kickVod) {
        buttons.push({
          type: 2,
          label: 'Watch Kick VOD',
          url: `https://kick.com/${streamMessage.kickStream.name}/videos/${streamMessage.kickVod.video.uuid}`,
          style: 5,
          emoji: {
            name: 'kick',
            id: '1404661261030916246',
            animated: false,
          },
        })
      }
    }
  }
  else {
    return { content: '', embeds: [], components: [] }
  }

  // TODO we should check if all the nessary data is there and not just '' for strings that are needed

  const titleComponent = {
    type: 10,
    content: message,
  }

  const container = {
    type: 17,
    accent_color: color,
    components: [
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `## [${title}](${url}) `,
          },
          {
            type: 10,
            content: `### ${description}${game ? `\n**Game**\n${game}` : ''}`,
          },
        ],
        accessory: {
          type: 11,
          media: {
            url: thumbnail,
          },
        },
      },

      {
        type: 12,
        items: [
          {
            media: { url: image },
          },
        ],
      },
      {
        type: 10,
        content: `-# <a:DinkDonk:1357111617787002962> DinkDonk Bot • ${status} • <t:${timestamp}>`,
      },
    ],
  }

  const components: APIMessageTopLevelComponent[] = []
  components.push(titleComponent, container)
  if (buttons.length > 0) {
    components.push({
      type: 1,
      components: buttons,
    })
  }

  return {
    components,
    flags: 1 << 15,
  }
}

export function buildErrorEmbed(error: string, env: Env, embed?: APIEmbed) {
  return {
    color: 0xFF0000,
    title: '❌ Oops! Something went wrong',
    description: `${error}`,
    footer: {
      text: 'DinkDonk Bot',
      icon_url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
    },
    timestamp: new Date().toISOString(),
    ...embed,
  } satisfies APIEmbed
}

export function buildSuccessEmbed(message: string, env: Env, embed?: APIEmbed) {
  return {
    color: 0x00FF00,
    title: '✅ Success',
    description: `${message}`,
    footer: {
      text: 'DinkDonk Bot',
      icon_url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
    },
    timestamp: new Date().toISOString(),
    ...embed,
  } satisfies APIEmbed
}
