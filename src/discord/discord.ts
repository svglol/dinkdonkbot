import type { RESTPostAPICurrentUserCreateDMChannelResult } from 'discord-api-types/v9'
import type { APIApplicationCommandOption, APIButtonComponent, APIEmbed, APIEmbedField, APIInteraction, APIMessageTopLevelComponent, RESTGetAPIApplicationCommandsResult, RESTGetAPIChannelResult, RESTGetAPIGuildEmojisResult, RESTGetAPIGuildMemberResult, RESTGetAPIGuildRolesResult, RESTPatchAPIChannelMessageJSONBody, RESTPatchAPIChannelMessageResult, RESTPostAPIChannelMessageJSONBody, RESTPostAPIChannelMessageResult, RESTPostAPIGuildEmojiResult, RESTPostAPIGuildStickerResult } from 'discord-api-types/v10'

import type { StreamMessage } from '../database/db'

import { chatInputApplicationCommandMention, escapeMarkdown } from '@discordjs/formatters'
import { DiscordAPIError, REST } from '@discordjs/rest'
import { PermissionFlagsBits, Routes } from 'discord-api-types/v10'

import { eq, tables, useDB } from '../database/db'
import { KICK_EMOTE, TWITCH_EMOTE } from '../util/discordEmotes'
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
        const kvKey = `channel:error:${channelId}`
        const channel = await env.KV.get(kvKey) as number | null

        const rest = new REST({ version: '10', makeRequest: fetch.bind(globalThis) as any }).setToken(discordToken)
        const discordChannel = await rest.get(Routes.channel(channelId)) as RESTGetAPIChannelResult
        if (discordChannel) {
          // channel exists we just dont have permission to post in it (lets not delete their subscriptions)
          return null
        }

        // If we havnt been able to post in the channel 3 times in the last week, then we can assume the channel has been deleted
        if (channel && channel > 2) {
          await useDB(env).delete(tables.streams).where(eq(tables.streams.channelId, channelId))
          await useDB(env).delete(tables.clips).where(eq(tables.clips.channelId, channelId))
          await useDB(env).delete(tables.kickStreams).where(eq(tables.kickStreams.channelId, channelId))
          await env.KV.delete(kvKey)
        }
        else {
          await env.KV.put(kvKey, JSON.stringify((channel || 0) + 1), { expirationTtl: 60 * 60 * 24 * 7 })
        }
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
 * @param env The environment variables from Cloudflare.
 * @param body The new content of the message as a DiscordBody object.
 * @throws If there is an error updating the interaction.
 */
export async function updateInteraction(interaction: APIInteraction, env: Env, body: RESTPatchAPIChannelMessageJSONBody) {
  const urls = [`https://discord.com`, env.DISCORD_PROXY]
  for (const url of urls) {
    try {
      const update = await fetch(`${url}/api/v10/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/@original`, {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (!update.ok)
        throw new Error(`Failed to update interaction: ${await update.text()}`)

      return await update.json()
    }
    catch (error) {
      console.error(`Error updating interaction at ${url}:`, error)
    }
  }
}

/**
 * Uploads a new emoji to the specified guild.
 *
 * @param guildId The ID of the guild to which the emoji should be uploaded.
 * @param env The environment variables from Cloudflare.
 * @param emojiName The desired name for the emoji.
 * @param imageBuffer The image data for the emoji as a Buffer.
 * @returns A DiscordEmoji object containing the ID of the uploaded emoji.
 *
 * @throws If there is an error uploading the emoji.
 */
// eslint-disable-next-line node/prefer-global/buffer
export async function uploadEmoji(guildId: string, env: Env, emojiName: string, imageBuffer: Buffer) {
  try {
    const rest = new REST({ version: '10', api: `${env.DISCORD_PROXY}/api`, makeRequest: fetch.bind(globalThis) as any }).setToken(env.DISCORD_TOKEN)
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
export async function uploadSticker(guildId: string, env: Env, stickerName: string, imageBuffer: Buffer<ArrayBufferLike>, imageExtension: string, description = 'stolen sticker', tags = 'stolen') {
  try {
    const form = new FormData()
    form.append('name', stickerName)
    form.append('description', description)
    form.append('tags', tags)
    const file = new File([imageBuffer], `${stickerName}.${imageExtension}`, {
      type: `image/${imageExtension}`,
    })
    form.append('file', file)

    const rest = new REST({ version: '10', api: `${env.DISCORD_PROXY}/api`, makeRequest: fetch.bind(globalThis) as any }).setToken(env.DISCORD_TOKEN)
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
 * Replaces placeholders in a message with actual values from a StreamMessage object.
 * Placeholders are as follows:
 * - `{{name}}`: The name of the streamer, with a platform-specific emote if `service` is set to 'both'.
 * - `{{twitch_name}}`: The name of the streamer on Twitch.
 * - `{{kick_name}}`: The name of the streamer on Kick.
 * - `{{url}}`: The URL of the streamer's channel, based on the `service` parameter.
 * - `{{twitch_url}}`: The URL of the streamer's Twitch channel.
 * - `{{kick_url}}`: The URL of the streamer's Kick channel.
 * - `{{everyone}}`: The '@everyone' mention.
 * - `{{here}}`: The '@here' mention.
 * - `{{game}}` or `{{category}}`: The game/category of the stream.
 * - `{{timestamp}}`: A timestamp in Discord's <t:timestamp:format> format, based on the `type` parameter.
 *
 * @param message The message to replace placeholders in.
 * @param streamMessage The StreamMessage object to get values from.
 * @param type Whether the message is for an online or offline stream. Used to determine which timestamp to use.
 * @param service The platform to get the streamer's URL from. Defaults to 'twitch'. If set to 'both', the URL will be a link to both Twitch and Kick.
 * @returns The message with placeholders replaced.
 */
export function messageBuilder(message: string, streamMessage: StreamMessage, type: 'online' | 'offline', service: 'twitch' | 'kick' | 'both' = 'twitch') {
  const twitchUrl = `https://twitch.tv/${streamMessage.stream?.name}`
  const kickUrl = `https://kick.com/${streamMessage.kickStream?.name}`

  let urlReplacement: string
  let nameReplacement: string

  switch (service) {
    case 'kick':
      urlReplacement = kickUrl
      nameReplacement = streamMessage.kickStream?.name || ''
      break
    case 'both':
      urlReplacement = `${twitchUrl} & ${kickUrl}`
      if (streamMessage.stream?.name === streamMessage.kickStream?.name) {
        nameReplacement = `${streamMessage.stream?.name || ''}`
      }
      else {
        nameReplacement = `${TWITCH_EMOTE.formatted}${streamMessage.stream?.name || ''} ${KICK_EMOTE.formatted}${streamMessage.kickStream?.name || ''}`
      }
      break
    case 'twitch':
    default:
      urlReplacement = twitchUrl
      nameReplacement = streamMessage.stream?.name || ''
      break
  }

  // Determine which timestamp to use based on online/offline status
  let timestampValue: string
  if (type === 'offline') {
    // Use ended_at timestamps for offline messages
    const endedAt = streamMessage.twitchStreamEndedAt || streamMessage.kickStreamEndedAt
    timestampValue = endedAt
      ? Math.floor(new Date(endedAt).getTime() / 1000).toString()
      : Math.floor(new Date().getTime() / 1000).toString()
  }
  else {
    // Use started_at timestamps for online messages
    const startedAt = streamMessage.twitchStreamData?.started_at || streamMessage.kickStreamData?.started_at || streamMessage.twitchStreamStartedAt || streamMessage.kickStreamStartedAt
    timestampValue = startedAt
      ? Math.floor(new Date(startedAt).getTime() / 1000).toString()
      : Math.floor(new Date().getTime() / 1000).toString()
  }

  let game = streamMessage.twitchStreamData?.game_name || streamMessage.kickStreamData?.category.name || ''
  if (streamMessage.stream?.multiStream?.priority || streamMessage.kickStream?.multiStream?.priority) {
    const priority = streamMessage.stream?.multiStream?.priority || streamMessage.kickStream?.multiStream?.priority
    game = priority === 'twitch' ? streamMessage.twitchStreamData?.game_name || streamMessage.kickStreamData?.category?.name || '' : streamMessage.kickStreamData?.category?.name || streamMessage.twitchStreamData?.game_name || ''
  }

  return message.replace(/\{\{name\}\}/gi, nameReplacement)
    .replace(/\{\{twitch_name\}\}/gi, streamMessage.stream?.name || '')
    .replace(/\{\{kick_name\}\}/gi, streamMessage.kickStream?.name || '')
    .replace(/\{\{url\}\}/gi, urlReplacement)
    .replace(/\{\{twitch_url\}\}/gi, twitchUrl)
    .replace(/\{\{kick_url\}\}/gi, kickUrl)
    .replace(/\{\{everyone\}\}/gi, '@everyone')
    .replace(/\{\{here\}\}/gi, '@here')
    .replace(/\{\{(game|category)\}\}/gi, game)
    .replace(/\{\{timestamp\}\}/gi, `<t:${timestampValue}:R>`)
}

export async function calculateChannelPermissions(guildId: string, channelId: string, botUserId: string, env: Env, permissionsToCheck?: bigint[]) {
  const rest = new REST({ version: '10', api: `${env.DISCORD_PROXY}/api` }).setToken(env.DISCORD_TOKEN)

  try {
    const channel = await rest.get(Routes.channel(channelId)) as RESTGetAPIChannelResult

    if (channel.type !== 0 && channel.type !== 5) {
      return { permissions: 0n, checks: {} }
    }

    const member = await rest.get(Routes.guildMember(guildId, botUserId)) as RESTGetAPIGuildMemberResult
    const guildRoles = await rest.get(Routes.guildRoles(guildId)) as RESTGetAPIGuildRolesResult

    let basePermissions = 0n
    const everyoneRole = guildRoles.find(r => r.id === guildId)
    if (everyoneRole) {
      basePermissions |= BigInt(everyoneRole.permissions)
    }

    // Calculate base permissions from roles
    for (const roleId of member.roles) {
      const role = guildRoles.find(r => r.id === roleId)
      if (role) {
        basePermissions |= BigInt(role.permissions)
      }
    }

    let finalPermissions = basePermissions

    if (channel.permission_overwrites) {
      const everyoneOverwrite = channel.permission_overwrites.find(
        overwrite => overwrite.id === guildId && overwrite.type === 0,
      )
      if (everyoneOverwrite) {
        finalPermissions &= ~BigInt(everyoneOverwrite.deny)
        finalPermissions |= BigInt(everyoneOverwrite.allow)
      }
      for (const overwrite of channel.permission_overwrites) {
        if (overwrite.id === botUserId && overwrite.type === 1) {
          // User-specific overwrite
          finalPermissions &= ~BigInt(overwrite.deny)
          finalPermissions |= BigInt(overwrite.allow)
        }
        else if (member.roles.includes(overwrite.id) && overwrite.type === 0) {
          // Role overwrite
          finalPermissions &= ~BigInt(overwrite.deny)
          finalPermissions |= BigInt(overwrite.allow)
        }
      }
    }

    // Check specific permissions if provided
    const checks: Record<string, boolean> = {}
    const hasPermission = (permission: bigint) => {
      return (finalPermissions & BigInt(permission)) === BigInt(permission)
    }
    function getPermissionName(permission: bigint): string {
      const entry = Object.entries(PermissionFlagsBits).find(([_, value]) => value === permission)
      return entry ? entry[0] : `Unknown_${permission.toString()}`
    }
    if (permissionsToCheck) {
      permissionsToCheck.forEach((permission) => {
        const permissionName = getPermissionName(permission)
        checks[permissionName] = hasPermission(permission)
      })
    }

    return { permissions: finalPermissions, checks }
  }
  catch (error: DiscordAPIError | unknown) {
    if (error instanceof DiscordAPIError) {
      if (error.code === 50001) {
        console.error(`Bot lacks access to channel ${channelId}`)
        return { permissions: 0n, checks: { ViewChannel: false } }
      }
    }
    console.error('Error calculating permissions:', error)
    return { permissions: 0n, checks: { Erorr: false } }
  }
}

/**
 * Fetches all custom emojis for a guild.
 *
 * @param guildId - The ID of the guild to fetch emojis from.
 * @param env - The environment variables from Cloudflare.
 * @returns An array of DiscordEmoji objects, each containing the ID and name of the emoji.
 *
 * @throws If there is an error fetching the emojis.
 */
export async function fetchGuildEmojis(guildId: string, env: Env) {
  try {
    const rest = new REST({ version: '10', api: `${env.DISCORD_PROXY}/api`, makeRequest: fetch.bind(globalThis) as any }).setToken(env.DISCORD_TOKEN)
    const emojis = await rest.get(Routes.guildEmojis(guildId)) as RESTGetAPIGuildEmojisResult
    return emojis
  }
  catch (error: unknown) {
    throw new Error(`Failed to fetch guild emojis ${error}`)
  }
}

export async function fetchBotCommands(discordToken: string, env: Env) {
  const cacheKey = `discord-commands:${env.DISCORD_APPLICATION_ID}`

  try {
    let commands = await env.KV.get<RESTGetAPIApplicationCommandsResult>(cacheKey, { type: 'json' })
    if (commands) {
      return commands
    }

    const rest = new REST({ version: '10', makeRequest: fetch.bind(globalThis) as any }).setToken(discordToken)

    commands = await rest.get(Routes.applicationCommands(env.DISCORD_APPLICATION_ID)) as RESTGetAPIApplicationCommandsResult

    await env.KV.put(cacheKey, JSON.stringify(commands), { expirationTtl: 300 })

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
export function bodyBuilder(streamMessage: StreamMessage, env: Env): RESTPostAPIChannelMessageJSONBody {
  const TWITCH_COLOR = 0x6441A4
  const KICK_COLOR = 0x53FC18
  const MULTI_COLOR = 0xFFF200
  const OFFLINE_COLOR = 0x747F8D

  interface Content {
    message?: string
    title?: string
    color?: number
    description?: string
    game?: string | undefined
    duration?: string | undefined
    status?: string
    timestamp?: string
    thumbnail?: string
    image?: string
    url?: string
    buttons?: APIButtonComponent[]
  }

  let content: Content = {
    message: '‎ ',
    title: '‎ ',
    color: 0xFFF200,
    description: '‎ ',
    game: undefined,
    duration: undefined,
    status: '‎ ',
    timestamp: new Date().toISOString(),
    thumbnail: streamMessage.twitchStreamerData?.profile_image_url || streamMessage.kickStreamerData?.user.profile_pic || `${env.WEBHOOK_URL}/static/default_profile.png`,
    image: `${env.WEBHOOK_URL}/static/default_image.png`,
    url: streamMessage.stream ? `https://twitch.tv/${streamMessage.twitchStreamerData?.login}` : `https://kick.com/${streamMessage.kickStreamerData?.slug}`,
    buttons: [],
  }

  function mergeContent(target: Content, source: Partial<Content>): Content {
    return Object.entries(source).reduce((acc, [key, value]) => {
      const isEmptyString
      = typeof value === 'string' && value.replace(/[\s\u200B-\u200F]/g, '') === ''

      if (value !== undefined && value !== null && !isEmptyString) {
        (acc as any)[key] = value
      }
      return acc
    }, { ...target })
  }

  function buildMultiOnlineMessage(streamMessage: StreamMessage, env: Env): Content {
    let message = ' '
    const roleMention = streamMessage.stream?.roleId && streamMessage.stream.roleId !== streamMessage.stream.guildId ? `<@&${streamMessage.stream.roleId}> ` : ''
    const kickRoleMention = streamMessage.kickStream?.roleId && streamMessage.kickStream.roleId !== streamMessage.kickStream.guildId ? `<@&${streamMessage.kickStream.roleId}> ` : ''

    if (streamMessage.stream?.liveMessage === streamMessage.kickStream?.liveMessage) {
      // we can combine the messages
      const mentionsArray = [roleMention, kickRoleMention].filter(Boolean)
      const mentions = mentionsArray[0] === mentionsArray[1] ? mentionsArray[0] || '' : mentionsArray.join(' ')
      message = [mentions, messageBuilder(
        streamMessage.stream?.liveMessage ? streamMessage.stream.liveMessage : '{{name}} is now live!',
        streamMessage,
        'online',
        'both',
      )].filter(Boolean).join(' ')
    }
    else {
      // Show both messages on different lines
      message = `${roleMention} ${messageBuilder(streamMessage.stream?.liveMessage || '{{name}} is now live!', streamMessage, 'online', 'twitch')}\n${kickRoleMention} ${messageBuilder(streamMessage.kickStream?.liveMessage || '{{name}} is now live!', streamMessage, 'online', 'kick')}`
    }

    const multiStream = streamMessage.stream?.multiStream || streamMessage.kickStream?.multiStream
    const priority = multiStream?.priority || 'twitch'

    const noTitle = messageBuilder('{{name}} is now live!', streamMessage, 'online', 'both')
    const title = priority === 'twitch' ? streamMessage.twitchStreamData?.title || streamMessage.kickStreamData?.stream_title || noTitle : streamMessage.kickStreamData?.stream_title || streamMessage.twitchStreamData?.title || noTitle
    let description = `${TWITCH_EMOTE.formatted} ${KICK_EMOTE.formatted} ${priority === 'twitch' ? streamMessage.stream?.name : streamMessage.kickStream?.name} is live on Twitch & KICK!`
    if (streamMessage.stream?.name.toLowerCase() !== streamMessage.kickStream?.name.toLowerCase()) {
      description = `${TWITCH_EMOTE.formatted}${streamMessage.stream?.name} & ${KICK_EMOTE.formatted}${streamMessage.kickStream?.name} is live on Twitch & KICK!`
    }
    const color = MULTI_COLOR
    const status = 'Online'

    const game = priority === 'twitch' ? streamMessage.twitchStreamData?.game_name || streamMessage.kickStreamData?.category?.name : streamMessage.kickStreamData?.category?.name || streamMessage.twitchStreamData?.game_name
    const timestamp = priority === 'twitch'
      ? new Date(streamMessage.twitchStreamData?.started_at || streamMessage.kickStreamData?.started_at || Date.now()).toISOString()
      : new Date(streamMessage.kickStreamData?.started_at || streamMessage.twitchStreamData?.started_at || Date.now()).toISOString()

    const twitchImage = streamMessage.twitchStreamData
      ? `${streamMessage.twitchStreamData.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')}?b=${streamMessage.twitchStreamData.id}&t=${Date.now()}`
      : streamMessage.twitchStreamerData?.offline_image_url

    const kickImage = streamMessage.kickStreamData ? `${streamMessage.kickStreamData?.thumbnail}?b=${streamMessage.kickStreamData?.started_at}&t=${Date.now()}` : streamMessage.kickStreamerData?.offline_banner_image?.src

    const image = priority === 'twitch'
      ? twitchImage || kickImage || `${env.WEBHOOK_URL}/static/default_image.png`
      : kickImage || twitchImage || `${env.WEBHOOK_URL}/static/default_image.png`

    const url = priority === 'twitch'
      ? `https://twitch.tv/${streamMessage.stream?.name}`
      : `https://kick.com/${streamMessage.kickStream?.name}`

    const buttons: APIButtonComponent[] = []
    // Add both platform buttons
    buttons.push({
      type: 2,
      label: 'Watch on Twitch',
      url: `https://twitch.tv/${streamMessage.stream?.name}`,
      style: 5,
      emoji: {
        name: TWITCH_EMOTE.name,
        id: TWITCH_EMOTE.id,
        animated: TWITCH_EMOTE.animated,
      },
    })
    buttons.push({
      type: 2,
      label: 'Watch on Kick',
      url: `https://kick.com/${streamMessage.kickStream?.name}`,
      style: 5,
      emoji: {
        name: KICK_EMOTE.name,
        id: KICK_EMOTE.id,
        animated: KICK_EMOTE.animated,
      },
    })

    return {
      message,
      title,
      color,
      description,
      game,
      status,
      timestamp,
      image,
      buttons,
      url,
    }
  }

  function buildMultiOfflineMessage(streamMessage: StreamMessage, env: Env): Content {
    let message = ''
    if (streamMessage.stream?.offlineMessage === streamMessage.kickStream?.offlineMessage) {
      message = messageBuilder(streamMessage.stream?.offlineMessage || streamMessage.kickStream?.offlineMessage || '{{name}} is now offline.', streamMessage, 'offline', 'both')
    }
    else {
      const twitchOfflineMessage = messageBuilder(streamMessage.stream?.offlineMessage ? streamMessage.stream.offlineMessage : '{{name}} is now offline.', streamMessage, 'offline', 'twitch')
      const kickOfflineMessage = messageBuilder(streamMessage.kickStream?.offlineMessage ? streamMessage.kickStream?.offlineMessage : '{{name}} is now offline.', streamMessage, 'offline', 'kick')
      message = `${twitchOfflineMessage}\n${kickOfflineMessage}`
    }

    const multiStream = streamMessage.stream?.multiStream || streamMessage.kickStream?.multiStream
    const priority = multiStream?.priority || 'twitch'

    const noTitle = messageBuilder('{{name}} has ended their streams!', streamMessage, 'offline', 'both')
    const title = priority === 'twitch' ? streamMessage.twitchStreamData?.title || streamMessage.kickStreamData?.stream_title || noTitle : streamMessage.kickStreamData?.stream_title || streamMessage.twitchStreamData?.title || noTitle
    let description = `${TWITCH_EMOTE.formatted} ${KICK_EMOTE.formatted} ${priority === 'twitch' ? streamMessage.stream?.name : streamMessage.kickStream?.name} is no longer live on Twitch & KICK!`
    if (streamMessage.stream?.name.toLowerCase() !== streamMessage.kickStream?.name.toLowerCase()) {
      description = `${TWITCH_EMOTE.formatted}${streamMessage.stream?.name} & ${KICK_EMOTE.formatted}${streamMessage.kickStream?.name} is no longer live on Twitch & KICK!`
    }
    const color = OFFLINE_COLOR
    const status = 'Last Online'

    // Calculate duration from the longer stream
    const twitchDuration = streamMessage.twitchVod?.duration
      || (streamMessage.twitchStreamEndedAt && streamMessage.twitchStreamStartedAt
        ? formatDuration(streamMessage.twitchStreamEndedAt.getTime() - streamMessage.twitchStreamStartedAt.getTime())
        : '0')

    const kickDuration = (streamMessage.kickVod && !Number.isNaN(streamMessage.kickVod.duration) && streamMessage.kickVod.duration > 0)
      ? formatDuration(streamMessage.kickVod.duration)
      : (streamMessage.kickStreamEndedAt && streamMessage.kickStreamStartedAt
          ? formatDuration(streamMessage.kickStreamEndedAt.getTime() - streamMessage.kickStreamStartedAt.getTime())
          : '0')

    const duration = priority === 'twitch' ? twitchDuration : kickDuration
    const timestamp = priority === 'twitch'
      ? new Date(streamMessage.twitchStreamEndedAt || streamMessage.kickStreamEndedAt || Date.now()).toISOString()
      : new Date(streamMessage.kickStreamEndedAt || streamMessage.twitchStreamEndedAt || Date.now()).toISOString()
    const twitchImage = streamMessage.twitchStreamerData?.offline_image_url || 'https://static-cdn.jtvnw.net/jtv-static/404_preview-1920x1080.png'
    const kickImage = streamMessage.kickStreamerData?.offline_banner_image?.src || 'https://kick.com/img/default-channel-banners/offline.webp'

    const image = priority === 'twitch'
      ? twitchImage || kickImage || `${env.WEBHOOK_URL}/static/default_image.png`
      : kickImage || twitchImage || `${env.WEBHOOK_URL}/static/default_image.png`

    const url = priority === 'twitch'
      ? `https://twitch.tv/${streamMessage.stream?.name}`
      : `https://kick.com/${streamMessage.kickStream?.name}`

    const buttons: APIButtonComponent[] = []
    // Add VOD buttons if available
    if (streamMessage.twitchVod) {
      buttons.push({
        type: 2,
        label: 'Watch Twitch VOD',
        url: `https://twitch.tv/videos/${streamMessage.twitchVod.id}`,
        style: 5,
        emoji: {
          name: TWITCH_EMOTE.name,
          id: TWITCH_EMOTE.id,
          animated: TWITCH_EMOTE.animated,
        },
      })
    }
    if (streamMessage.kickVod) {
      buttons.push({
        type: 2,
        label: 'Watch Kick VOD',
        url: `https://kick.com/${streamMessage.kickStream?.name}/videos/${streamMessage.kickVod.video.uuid}`,
        style: 5,
        emoji: {
          name: KICK_EMOTE.name,
          id: KICK_EMOTE.id,
          animated: KICK_EMOTE.animated,
        },
      })
    }

    buttons.push({
      type: 2,
      label: 'Get Top Clips from Stream',
      style: 2,
      custom_id: `top-clips:${streamMessage.twitchStreamerData?.id}:${streamMessage.twitchStreamStartedAt?.getTime()}:${streamMessage.twitchStreamEndedAt?.getTime()}`,
      emoji: {
        name: TWITCH_EMOTE.name,
        id: TWITCH_EMOTE.id,
        animated: TWITCH_EMOTE.animated,
      },
    })
    return {
      message,
      title,
      color,
      description,
      duration,
      status,
      timestamp,
      image,
      buttons,
      url,
    }
  }

  function buildTwitchOnlineMessage(streamMessage: StreamMessage, env: Env): Content {
    const color = TWITCH_COLOR
    const message = `${streamMessage.stream?.roleId && streamMessage.stream.roleId !== streamMessage.stream.guildId ? `<@&${streamMessage.stream.roleId}> ` : ''}${messageBuilder(streamMessage.stream?.liveMessage ? streamMessage.stream.liveMessage : '{{name}} is live!', streamMessage, 'online', 'twitch')}`
    const title = streamMessage.twitchStreamData?.title || `${streamMessage.twitchStreamerData?.display_name} is live!`
    const description = `${TWITCH_EMOTE.formatted} ${streamMessage.twitchStreamerData?.display_name} is live on Twitch!`
    const game = streamMessage.twitchStreamData?.game_name || 'No game'
    const status = 'Online'
    const timestamp = new Date(streamMessage.twitchStreamData?.started_at || Date.now()).toISOString()
    const image = streamMessage.twitchStreamData ? `${streamMessage.twitchStreamData.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')}?b=${streamMessage.twitchStreamData.id}&t=${new Date().getTime()}` : streamMessage.twitchStreamerData?.offline_image_url || streamMessage.twitchStreamerData?.profile_image_url || `${env.WEBHOOK_URL}/static/default_profile.png`
    const url = `https://twitch.tv/${streamMessage.stream?.name}`
    const buttons: APIButtonComponent[] = []
    buttons.push({
      type: 2,
      label: 'Watch Twitch Stream',
      url: `https://twitch.tv/${streamMessage.twitchStreamerData?.login}`,
      style: 5,
      emoji: {
        name: TWITCH_EMOTE.name,
        id: TWITCH_EMOTE.id,
        animated: TWITCH_EMOTE.animated,
      },
    })

    return {
      message,
      title,
      color,
      description,
      game,
      status,
      timestamp,
      image,
      buttons,
      url,
    }
  }

  function buildTwitchOfflineMessage(streamMessage: StreamMessage, _env: Env): Content {
    const color = OFFLINE_COLOR
    const message = messageBuilder(streamMessage.stream?.offlineMessage ? streamMessage.stream.offlineMessage : '{{name}} is now offline.', streamMessage, 'offline', 'twitch')
    const title = streamMessage.twitchStreamData?.title || `${streamMessage.twitchStreamerData?.display_name ?? streamMessage.stream?.name} is no longer live!`
    const duration = streamMessage.twitchVod
      ? streamMessage.twitchVod.duration
      : streamMessage.twitchStreamEndedAt && streamMessage.twitchStreamStartedAt
        ? formatDuration(streamMessage.twitchStreamEndedAt.getTime() - streamMessage.twitchStreamStartedAt.getTime())
        : '0'
    const description = `${TWITCH_EMOTE.formatted} ${streamMessage.twitchStreamerData?.display_name ?? streamMessage.stream?.name} is no longer live on Twitch!`
    const status = 'Last online'
    const timestamp = new Date(streamMessage.twitchStreamEndedAt || Date.now()).toISOString()
    const backupImage = streamMessage.twitchStreamData ? `${streamMessage.twitchStreamData.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')}?b=${streamMessage.twitchStreamData.id}&t=${new Date().getTime()}` : 'https://static-cdn.jtvnw.net/jtv-static/404_preview-1920x1080.png'
    const image = streamMessage.twitchStreamerData?.offline_image_url || backupImage
    const url = `https://twitch.tv/${streamMessage.stream?.name}`

    const buttons: APIButtonComponent[] = []
    if (streamMessage.twitchVod) {
      buttons.push({
        type: 2,
        label: 'Watch Twitch VOD',
        url: `https://twitch.tv/videos/${streamMessage.twitchVod.id}`,
        style: 5,
        emoji: {
          name: TWITCH_EMOTE.name,
          id: TWITCH_EMOTE.id,
          animated: TWITCH_EMOTE.animated,
        },
      })
    }
    buttons.push({
      type: 2,
      label: 'Get Top Clips from Stream',
      style: 2,
      custom_id: `top-clips:${streamMessage.twitchStreamerData?.id}:${streamMessage.twitchStreamStartedAt?.getTime()}:${streamMessage.twitchStreamEndedAt?.getTime()}`,
      emoji: {
        name: TWITCH_EMOTE.name,
        id: TWITCH_EMOTE.id,
        animated: TWITCH_EMOTE.animated,
      },
    })
    return {
      message,
      title,
      color,
      description,
      duration,
      status,
      timestamp,
      image,
      buttons,
      url,
    }
  }

  function buildKickOnlineMessage(streamMessage: StreamMessage, _env: Env): Content {
    const roleMention = streamMessage.kickStream?.roleId && streamMessage.kickStream.roleId !== streamMessage.kickStream.guildId ? `<@&${streamMessage.kickStream.roleId}> ` : ''
    const message = `${roleMention}${messageBuilder(streamMessage.kickStream?.liveMessage ? streamMessage.kickStream.liveMessage : '{{name}} is live!', streamMessage, 'online', 'kick')}`
    let title = streamMessage.kickStreamData?.stream_title || `${streamMessage.kickStreamerData?.slug ?? streamMessage.kickStream?.name} is live!`
    const description = `${KICK_EMOTE.formatted} ${streamMessage.kickStream?.name ?? streamMessage.kickStreamerData?.slug} is live on KICK!`
    let game = streamMessage.kickStreamData?.category.name || 'No game'
    const status = 'Online'
    const timestamp = new Date(streamMessage.kickStreamData?.started_at || Date.now()).toISOString()
    const image = streamMessage.kickStreamData?.thumbnail ? `${streamMessage.kickStreamData?.thumbnail}?b=${streamMessage.kickStreamData?.started_at}&t=${new Date().getTime()}` : 'https://kick.com/img/default-channel-banners/offline.webp'
    const url = `https://kick.com/${streamMessage.kickStream?.name}`
    const buttons: APIButtonComponent[] = []

    // current issue with some getLiveStream from kick api returning the wrong stream title/category
    if (streamMessage.kickStreamData?.stream_title !== streamMessage.kickStreamerData?.livestream?.session_title) {
      title = streamMessage.kickStreamerData?.livestream?.session_title || `${streamMessage.kickStream?.name} is live!`
    }
    if (streamMessage.kickStreamData?.category.name !== streamMessage.kickStreamerData?.livestream?.categories[0].name) {
      game = streamMessage.kickStreamerData?.livestream?.categories[0].name || 'No game'
    }

    buttons.push({
      type: 2,
      label: 'Watch Kick Stream',
      url: `https://kick.com/${streamMessage.kickStream?.name}`,
      style: 5,
      emoji: {
        name: KICK_EMOTE.name,
        id: KICK_EMOTE.id,
        animated: KICK_EMOTE.animated,
      },
    })
    return {
      message,
      title,
      color: KICK_COLOR,
      description,
      game,
      duration: undefined,
      status,
      timestamp,
      image,
      buttons,
      url,
    }
  }

  function buildKickOfflineMessage(streamMessage: StreamMessage, env: Env): Content {
    const buttons: APIButtonComponent[] = []
    if (streamMessage.kickVod) {
      buttons.push({
        type: 2,
        label: 'Watch Kick VOD',
        url: `https://kick.com/${streamMessage.kickStream?.name}/videos/${streamMessage.kickVod.video.uuid}`,
        style: 5,
        emoji: {
          name: KICK_EMOTE.name,
          id: KICK_EMOTE.id,
          animated: KICK_EMOTE.animated,
        },
      })
    }
    let title = streamMessage.kickStreamData?.stream_title || `${streamMessage.kickStreamerData?.slug ?? streamMessage.kickStream?.name} is no longer live!`
    // current issue with some getLiveStream from kick api returning the wrong stream title/category
    if (streamMessage.kickStreamData?.stream_title !== streamMessage.kickStreamerData?.livestream?.session_title) {
      title = streamMessage.kickStreamerData?.livestream?.session_title || `${streamMessage.kickStream?.name} is live!`
    }

    const duration = streamMessage.kickVod && !Number.isNaN(streamMessage.kickVod.duration) && streamMessage.kickVod.duration > 0
      ? formatDuration(streamMessage.kickVod.duration)
      : streamMessage.kickStreamEndedAt && streamMessage.kickStreamStartedAt
        ? formatDuration(streamMessage.kickStreamEndedAt.getTime() - streamMessage.kickStreamStartedAt.getTime())
        : '0'
    return {
      message: messageBuilder(streamMessage.kickStream?.offlineMessage ? streamMessage.kickStream?.offlineMessage : '{{name}} is now offline.', streamMessage, 'offline', 'kick'),
      title,
      color: OFFLINE_COLOR,
      description: `${KICK_EMOTE.formatted} ${streamMessage.kickStream?.name ?? streamMessage.kickStreamerData?.slug} is no longer live on KICK!`,
      duration,
      status: '‎Last Online',
      timestamp: new Date(streamMessage.kickStreamEndedAt || Date.now()).toISOString(),
      image: streamMessage.kickStreamerData?.offline_banner_image?.src || 'https://kick.com/img/default-channel-banners/offline.webp' || `${env.WEBHOOK_URL}/static/default_image.png`,
      buttons,
      url: `https://kick.com/${streamMessage.kickStream?.name}`,
    }
  }

  // check if we should build a message
  if ((!streamMessage.twitchOnline && streamMessage.stream?.cleanup) && (!streamMessage.kickOnline && streamMessage.kickStream?.cleanup)) {
    return { content: '', embeds: [], components: [] }
  }
  else if ((!streamMessage.twitchOnline && streamMessage.stream?.cleanup) && !streamMessage.kickStream) {
    return { content: '', embeds: [], components: [] }
  }
  else if ((!streamMessage.kickOnline && streamMessage.kickStream?.cleanup) && !streamMessage.stream) {
    return { content: '', embeds: [], components: [] }
  }

  // build the message
  if (streamMessage.kickStream && streamMessage.stream) {
    const bothOnline = streamMessage.twitchOnline && streamMessage.kickOnline
    const bothOffline = !streamMessage.twitchOnline && !streamMessage.kickOnline
    if (streamMessage.stream && streamMessage.kickStream) {
      if (bothOnline) {
        content = mergeContent(content, buildMultiOnlineMessage(streamMessage, env))
      }
      else if (bothOffline) {
      // Both streams are offline
        content = mergeContent(content, buildMultiOfflineMessage(streamMessage, env))
      }
      else {
      // One platform online, one offline - prioritize the online one
        if (streamMessage.twitchOnline) {
          // Twitch is live, Kick is offline
          content = mergeContent(content, buildTwitchOnlineMessage(streamMessage, env))
        }
        else {
        // Kick is live, Twitch is offline
          content = mergeContent(content, buildKickOnlineMessage(streamMessage, env))
        }
      }
    }
  }
  else if (streamMessage.stream) {
    if (streamMessage.twitchOnline) {
      content = mergeContent(content, buildTwitchOnlineMessage(streamMessage, env))
    }
    else {
      content = mergeContent(content, buildTwitchOfflineMessage(streamMessage, env))
    }
  }
  else if (streamMessage.kickStream) {
    if (streamMessage.kickOnline) {
      content = mergeContent(content, buildKickOnlineMessage(streamMessage, env))
    }
    else {
      content = mergeContent(content, buildKickOfflineMessage(streamMessage, env))
    }
  }

  function fixedEscapeMarkdown(text: string) {
    text = escapeMarkdown(text)
    if (text.startsWith('#')) {
      text = `\\${text}`
    }
    return text
  }

  const fields: APIEmbedField[] = []

  if (content.game) {
    fields.push({
      name: 'Category',
      value: fixedEscapeMarkdown(content.game),
    })
  }
  if (content.duration) {
    fields.push({
      name: 'Streamed for',
      value: fixedEscapeMarkdown(content.duration),
    })
  }

  const embed = {
    title: fixedEscapeMarkdown(content.title || 'No title'),
    description: `**${fixedEscapeMarkdown(content.description || 'No description')}**`,
    fields,
    color: content.color || MULTI_COLOR,
    thumbnail: {
      url: content.thumbnail || `${env.WEBHOOK_URL}/static/default_profile.png`,
    },
    image: {
      url: content.image || `${env.WEBHOOK_URL}/static/default_image.png`,
    },
    footer: {
      text: content.status || '‎ ',
      icon_url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
    },
    url: content.url || undefined,
    timestamp: content.timestamp || new Date().toISOString(),
  } satisfies APIEmbed

  const components: APIMessageTopLevelComponent[] = []
  if ((content.buttons ?? []).length > 0) {
    components.push({
      type: 1,
      components: content.buttons ?? [],
    })
  }

  return {
    content: content.message,
    components,
    embeds: [embed],
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

export async function findBotCommand(env: Env, commandName: string, subCommandGroupName?: string, subCommandName?: string) {
  const commands = await fetchBotCommands(env.DISCORD_TOKEN, env)

  // Find the main command
  const command = commands.find(c => c.name === commandName)
  if (!command)
    return null

  // No subcommand group requested
  if (!subCommandGroupName) {
    // No subcommand either
    if (!subCommandName)
      return command

    // Try to find subcommand directly under main command
    if (command.options) {
      const sub = command.options.find(o => o.type === 1 && o.name === subCommandName)
      if (sub)
        return { ...command, subcommand: sub }
    }

    return null
  }

  // Subcommand group requested
  if (command.options) {
    const group = command.options.find((o): o is APIApplicationCommandOption & { options: APIApplicationCommandOption[] } => o.type === 2 && o.name === subCommandGroupName)
    if (group && group.options) {
      const sub = group.options.find((o): o is APIApplicationCommandOption => o.type === 1 && o.name === subCommandName)
      if (sub)
        return { ...command, subcommandGroup: group, subcommand: sub }
    }
  }

  return null
}

export async function findBotCommandMarkdown(env: Env, commandName: string): Promise<string>
export async function findBotCommandMarkdown(env: Env, commandName: string, subCommandName: string): Promise<string>
export async function findBotCommandMarkdown(env: Env, commandName: string, subCommandGroupName: string, subCommandName: string): Promise<string>

export async function findBotCommandMarkdown(env: Env, commandName: string, arg2?: string, arg3?: string) {
  let subCommandGroupName: string | undefined
  let subCommandName: string | undefined

  if (arg3) {
    subCommandGroupName = arg2
    subCommandName = arg3
  }
  else if (arg2) {
    subCommandName = arg2
  }

  const command = await findBotCommand(env, commandName, subCommandGroupName, subCommandName)

  if (!command) {
    return `\`/${commandName}${subCommandGroupName ? ` ${subCommandGroupName}` : ''}${subCommandName ? ` ${subCommandName}` : ''}\``
  }

  if ('subcommand' in command && command.subcommand) {
    if ('subcommandGroup' in command && command.subcommandGroup) {
      return chatInputApplicationCommandMention(
        commandName,
        command.subcommandGroup.name,
        command.subcommand.name,
        command.id,
      )
    }
    else {
      return chatInputApplicationCommandMention(
        commandName,
        command.subcommand.name,
        command.id,
      )
    }
  }

  return chatInputApplicationCommandMention(commandName, command.id)
}

export async function directMessageUser(env: Env, userId: string, body: RESTPostAPIChannelMessageJSONBody) {
  try {
    const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN)

    const dmChannel = await rest.post(Routes.userChannels(), {
      body: {
        recipient_id: userId,
      },
    }) as RESTPostAPICurrentUserCreateDMChannelResult

    const message = await rest.post(Routes.channelMessages(dmChannel.id), {
      body,
    }) as RESTPostAPIChannelMessageResult

    return message
  }
  catch (error) {
    console.error('Error sending direct message:', error)
  }
}
