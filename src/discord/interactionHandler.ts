import type { APIApplicationCommandInteraction, APIEmbed } from 'discord-api-types/v10'
import type { StreamMessage } from '../database/db'
import { isChatInputApplicationCommandInteraction, isContextMenuApplicationCommandInteraction, isGuildInteraction } from 'discord-api-types/utils'
import { InteractionResponseFlags, InteractionResponseType } from 'discord-interactions'
import { and, eq, like } from 'drizzle-orm'
import { tables, useDB } from '../database/db'
import { getKickChannel, getKickChannelV2, getKickLivestream, kickSubscribe, kickUnsubscribe } from '../kick/kick'
import { getChannelId, getStreamDetails, getStreamerDetails, removeSubscription, subscribe } from '../twitch/twitch'
import { fetch7tvEmoteImageBuffer, fetchEmoteImageBuffer, fetchSingular7tvEmote } from '../util/emote'
import { JsonResponse } from '../util/jsonResponse'
import * as commands from './commands'
import { bodyBuilder, checkChannelPermission, sendMessage, updateInteraction, uploadEmoji } from './discord'

/**
 * Handles an interaction from Discord.
 *
 * If the interaction is an application command, it checks the command name and
 * dispatches to the appropriate handler.  If the interaction is not an
 * application command, or if the command does not have a handler, it returns an
 * ephemeral error message.
 *
 * @param interaction The interaction object from Discord.
 * @param env The environment variables from Cloudflare.
 * @param ctx The context object from Cloudflare.
 *
 * @returns A response to Discord, or a promise that resolves to one.
 */
export async function discordInteractionHandler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  if (!interaction.data) {
    ctx.waitUntil(updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid interaction' }))
    return interactionEphemeralLoading()
  }

  switch (interaction.data.name.toLowerCase()) {
    case commands.EMOTE_COMMAND.name.toLowerCase(): {
      ctx.waitUntil(handleEmoteCommand(interaction, env))
      return interactionEphemeralLoading()
    }
    case commands.TWITCH_CLIPS_COMMAND.name.toLowerCase(): {
      ctx.waitUntil(handleTwitchClipsCommand(interaction, env))
      return interactionEphemeralLoading()
    }
    case commands.INVITE_COMMAND.name.toLowerCase(): {
      ctx.waitUntil(handleInviteCommand(env, interaction))
      return interactionEphemeralLoading()
    }
    case commands.TWITCH_COMMAND.name.toLowerCase(): {
      ctx.waitUntil(handleTwitchCommand(interaction, env))
      return interactionEphemeralLoading()
    }
    case commands.DINKDONK_COMMAND.name.toLowerCase(): {
      ctx.waitUntil(handleDinkdonkCommand(env, interaction))
      return interactionLoading()
    }
    case commands.STEAL_EMOTE_COMMAND.name.toLowerCase(): {
      ctx.waitUntil(handleStealEmoteCommand(interaction, env))
      return interactionEphemeralLoading()
    }
    case commands.KICK_COMMAND.name.toLowerCase(): {
      ctx.waitUntil(handleKickCommand(interaction, env))
      return interactionEphemeralLoading()
    }
    case commands.HELP_COMMAND.name.toLowerCase(): {
      ctx.waitUntil(handleHelpCommand(interaction, env))
      return interactionEphemeralLoading()
    }
    default: {
      ctx.waitUntil(updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid command' }))
      return interactionEphemeralLoading()
    }
  }
}

/**
 * Returns a deferred interaction response that is ephemeral.
 *
 * A deferred ephemeral interaction response is one that only the user who
 * invoked the interaction can see.  This is useful for commands that are
 * potentially expensive or that return a large amount of data, as it allows
 * the user to see the response without spamming the channel.
 *
 * @returns A deferred interaction response that is ephemeral.
 */
function interactionEphemeralLoading() {
  return new JsonResponse({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  })
}

/**
 * Returns a deferred interaction response that is not ephemeral.
 *
 * A deferred interaction response is one that will be sent to the channel
 * that the user invoked the interaction in, but will not be sent immediately.
 * This is useful for commands that are potentially expensive or that return
 * a large amount of data, as it allows the user to see the response without
 * spamming the channel.
 *
 * @returns A deferred interaction response that is not ephemeral.
 */
function interactionLoading() {
  return new JsonResponse({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  })
}

/**
 * This function is called when a user interacts with the /twitch command.
 * It will add a streamer to the list of streamers that will be notified
 * when they go live or offline.
 * @param interaction The interaction object as provided by Discord.
 * @param env The environment object as provided by the caller.
 * @returns A promise that resolves to nothing.
 */
async function handleTwitchCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid interaction' })
  if (!interaction.data.options)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'This command can only be used in a server' })

  const option = interaction.data.options[0].name
  switch (option) {
    case 'add': {
      const server = interaction.guild_id
      const add = interaction.data.options.find(option => option.name === 'add')
      if (!add || !('options' in add) || !add.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })

      const streamerOption = add.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      const channelOption = add.options.find(option => option.name === 'discord-channel')
      const channel = channelOption && 'value' in channelOption ? channelOption.value as string : undefined
      const roleOption = add.options.find(option => option.name === 'ping-role')
      const role = roleOption && 'value' in roleOption ? roleOption.value as string : undefined
      const messageOption = add.options.find(option => option.name === 'live-message')
      const liveMessage = messageOption && 'value' in messageOption ? messageOption.value as string : undefined
      const offlineMessageOption = add.options.find(option => option.name === 'offline-message')
      const offlineMessage = offlineMessageOption && 'value' in offlineMessageOption ? offlineMessageOption.value as string : undefined
      // make sure we have all arguments
      if (!server || !streamer || !channel)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })

      // check if already subscribed to this channel
      const subscriptions = await useDB(env).query.streams.findMany({
        where: (streams, { eq, and, like }) => and(eq(streams.guildId, server), like(streams.name, streamer)),
      })
      if (subscriptions.length > 0)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Already subscribed to this streamer' })

      // check if twitch channel exists
      const channelId = await getChannelId(streamer, env)
      if (!channelId)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find twitch channel' })

      // check if we have permission to post in this discord channel
      const hasPermission = await checkChannelPermission(channel, env.DISCORD_TOKEN)
      if (!hasPermission)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'This bot does not have permission to post in this channel' })

      // subscribe to event sub for this channel
      const subscribed = await subscribe(channelId, env)
      if (!subscribed)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not subscribe to this twitch channel' })

      let roleId: string | undefined
      if (roleOption) {
        roleId = role
        if (roleId === server)
          roleId = undefined
      }

      const liveText = liveMessage
      const offlineText = offlineMessage

      const streamerDetails = await getStreamerDetails(streamer, env)

      // add to database
      await useDB(env).insert(tables.streams).values({
        name: streamerDetails ? streamerDetails.display_name : streamer,
        broadcasterId: channelId,
        guildId: server,
        channelId: channel,
        roleId,
        liveMessage: liveText,
        offlineMessage: offlineText,
      })

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Successfully subscribed to notifications for **${streamer}** in <#${channel}>` })
    }
    case 'remove': {
      const remove = interaction.data.options.find(option => option.name === 'remove')
      if (!remove || !('options' in remove) || !remove.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamerOption = remove.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const stream = await useDB(env).query.streams.findFirst({
        where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
      })
      if (!stream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription' })

      await useDB(env).delete(tables.streams).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))
      const subscriptions = await useDB(env).query.streams.findMany({
        where: (streams, { like }) => like(streams.name, streamer),
      })
      if (subscriptions.length === 0 && stream)
        await removeSubscription(stream.broadcasterId, env)

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Successfully unsubscribed to notifications for **${streamer}**` })
    }
    case 'edit':{
      const server = interaction.guild_id
      const edit = interaction.data.options.find(option => option.name === 'edit')
      if (!edit || !('options' in edit) || !edit.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamerOption = edit.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const dbStream = await useDB(env).query.streams.findFirst({
        where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
      })
      if (!dbStream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription' })

      const channel = edit.options.find(option => option.name === 'discord-channel')
      if (channel)
        await useDB(env).update(tables.streams).set({ channelId: String('value' in channel ? channel.value : '') }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))
      const role = edit.options.find(option => option.name === 'ping-role')
      let roleId: string | undefined
      if (role) {
        roleId = 'value' in role ? String(role.value) : undefined
        if (roleId === server)
          roleId = undefined
      }
      if (roleId)
        await useDB(env).update(tables.streams).set({ roleId }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))

      const message = edit.options.find(option => option.name === 'live-message')
      if (message)
        await useDB(env).update(tables.streams).set({ liveMessage: 'value' in message ? message.value as string : '' }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))

      const offlineMessage = edit.options.find(option => option.name === 'offline-message')
      if (offlineMessage)
        await useDB(env).update(tables.streams).set({ offlineMessage: 'value' in offlineMessage ? offlineMessage.value as string : '' }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Successfully edited notifications for **${streamer}**` })
    }
    case 'list': {
      const streams = await useDB(env).query.streams.findMany({
        where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id),
      })
      let streamList = 'Not subscribed to any streams'
      if (streams.length > 0)
        streamList = streams.map(stream => `**${stream.name}** - <#${stream.channelId}>`).join('\n')

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: streamList })
    }
    case 'test':{
      const test = interaction.data.options.find(option => option.name === 'test')
      if (!test || !('options' in test) || !test.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamer = test.options.find(option => option.name === 'streamer')
      const global = test.options.find(option => option.name === 'global')
      const stream = await useDB(env).query.streams.findFirst({
        where: (streams, { and, eq, like }) => and(like(streams.name, streamer && 'value' in streamer ? streamer.value as string : ''), eq(streams.guildId, interaction.guild_id)),
      })
      if (!stream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription' })

      const [streamerData, streamData] = await Promise.all([
        getStreamerDetails(stream.name, env),
        getStreamDetails(stream.name, env),
      ])
      // build a fake stream message object
      const streamMessage = {
        id: 0,
        streamId: stream.id,
        stream,
        kickStreamId: null,
        kickStreamStartedAt: null,
        kickStreamEndedAt: null,
        twitchStreamStartedAt: new Date(),
        twitchStreamEndedAt: null,
        discordChannelId: stream.channelId,
        discordMessageId: null,
        twitchStreamId: null,
        twitchOnline: true,
        twitchStreamData: streamData,
        twitchStreamerData: streamerData,
        twitchVod: null,
        kickStreamData: null,
        kickStreamerData: null,
        kickVod: null,
        kickOnline: false,
        createdAt: new Date().toISOString(),
      } satisfies StreamMessage

      const body = bodyBuilder(streamMessage, env)
      if (global) {
        if ('value' in global && global.value === true) {
          await sendMessage(stream.channelId, env.DISCORD_TOKEN, body, env)
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Successfully sent test message for **${streamer}**` })
        }
        else {
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, body)
        }
      }
      else {
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, body)
      }
    }
    case 'details': {
      const details = interaction.data.options.find(option => option.name === 'details')
      if (!details || !('options' in details) || !details.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamer = details.options.find(option => option.name === 'streamer')
      const stream = await useDB(env).query.streams.findFirst({
        where: (streams, { and, eq, like }) => and(like(streams.name, streamer && 'value' in streamer ? streamer.value as string : ''), eq(streams.guildId, interaction.guild_id)),
      })
      if (!stream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription' })
      let message = `Streamer: \`${stream.name}\`\n`
      message += `Channel: <#${stream.channelId}>\n`
      message += `Live Message: \`${stream.liveMessage}\`\n`
      message += `Offline Message: \`${stream.offlineMessage}\`\n`
      if (stream.roleId)
        message += `\n Role: <@&${stream.roleId}>`

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: message })
    }
    case 'help': {
      const embed = {
        title: '<:twitch:1404661243373031585> Available commands',
        description: '',
        color: 0x6441A4,
        fields: [
          {
            name: '</twitch add:1227872472049782919> <streamer> <discord-channel> <ping-role> <live-message> <offline-message>',
            value: 'Add a Twitch streamer to receive notifications for going online or offline\n<streamer> - The name of the streamer to add \n<discord-channel> - The discord channel to post to when the streamer goes live\n<ping-role> - What role to @ when the streamer goes live\n<live-message> - The message to post when the streamer goes live\n<offline-message> - The message to post when the streamer goes offline',
          },
          {
            name: '</twitch edit:1227872472049782919> <streamer> <discord-channel> <ping-role> <live-message> <offline-message>',
            value: 'Edit a Twitch streamer\'s settings\n<streamer> - The name of the streamer to edit \n<discord-channel> - The discord channel to post to when the streamer goes live\n<ping-role> - What role to @ when the streamer goes live\n<live-message> - The message to post when the streamer goes live\n<offline-message> - The message to post when the streamer goes offline',
          },
          {
            name: '</twitch remove:1227872472049782919> <streamer>',
            value: 'Remove a Twitch streamer from receiving notifications for going online or offline\n<streamer> - The name of the streamer to remove',
          },
          {
            name: '</twitch list:1227872472049782919>',
            value: 'List the twitch streamers that you are subscribed to',
          },
          {
            name: '</twitch test:1227872472049782919> <streamer> <global>',
            value: 'Test the notification for a streamer \n<streamer> - The name of the streamer to test \n<global> - Whether to send the message to everyone or not',
          },
          {
            name: '</twitch details:1227872472049782919> <streamer>',
            value: 'Show the details for a streamer you are subscribed to\n<streamer> - The name of the streamer to show',
          },
          {
            name: '</twitch help:1227872472049782919>',
            value: 'Get this help message',
          },
          {
            name: 'Message variables',
            value: '```{{name}} = the name of the streamer\n{{url}} = the url for the stream\n{{everyone}} = @everyone\n{{here}} = @here\n{{game}} or {{category}} = the game or category of the stream - only works on live message\n{{timestamp}} = the time the stream started/ended\n```',
          },
        ],
      }
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [embed] })
    }
  }
}

/**
 * Handle the /invite command.
 * @param env The environment object
 * @param interaction The interaction object from Discord
 * @returns A promise that resolves to nothing
 */
async function handleInviteCommand(env: Env, interaction: APIApplicationCommandInteraction) {
  const applicationId = env.DISCORD_APPLICATION_ID
  const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${applicationId}&permissions=8797166895104&scope=applications.commands+bot`
  const inviteMessage = `[Click here to invite the bot to your server!](${INVITE_URL})`
  return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: inviteMessage })
}

/**
 * Handle the /emote command.
 * @param interaction The interaction object from Discord
 * @param env The environment object
 * @returns A promise that resolves to nothing
 *
 * If the user provides a URL to an emoji, it will be uploaded to Discord and
 * the emote will be added to the server.  If the user provides a 7tv link,
 * the bot will fetch the emote from 7tv and upload it to Discord and add it
 * to the server.  If the user provides a raw emoji, the bot will fetch the
 * emoji from Discord and upload it to Discord and add it to the server.
 */
async function handleEmoteCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid interaction' })
  if (!interaction.data.options)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'This command can only be used in a server' })
  const option = interaction.data.options[0].name
  switch (option) {
    case 'add': {
      const add = interaction.data.options.find(option => option.name === 'add')
      if (!add || !('options' in add) || !add.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const emoteOption = add.options.find(option => option.name === 'url_or_emoji')
      if (!emoteOption)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const emote = 'value' in emoteOption ? emoteOption.value as string : ''

      const is7tvLink = /^https?:\/\/7tv\.app\/emotes\/[a-zA-Z0-9]+$/.test(emote)

      if (emote.startsWith('<a:') || emote.startsWith('<:')) {
        const isAnimated = emote.startsWith('<a:')
        const content = isAnimated ? emote.slice(3, -1) : emote.slice(2, -1)
        const [name, id] = content.split(':')
        let cleanName = name.replace(/[^\w\s]/g, '')
        cleanName = cleanName.padEnd(2, '_').slice(0, 32)
        const extension = isAnimated ? 'gif' : 'png'
        const emoteUrl = `https://cdn.discordapp.com/emojis/${id}.${extension}`

        // // Check if the emote already exists in the guild
        // try {
        //   const emojis = await fetchGuildEmojis(interaction.guild_id, env.DISCORD_TOKEN)
        //   if (emojis.some(emoji => emoji.id === id)) {
        //     return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `That emote is already from this server.` })
        //   }
        // }
        // catch (error) {
        //   console.error('Error checking if emote already exists:', error)
        // }

        try {
          const imageBuffer = await fetchEmoteImageBuffer(emoteUrl)
          const discordEmote = await uploadEmoji(interaction.guild_id, env.DISCORD_TOKEN, cleanName, imageBuffer)
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Emote added: <${isAnimated ? 'a' : ''}:${cleanName}:${discordEmote.id}>` })
        }
        catch (error) {
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `${error}` })
        }
      }

      if (is7tvLink) {
        const emoteUrl = emote
        const match = emoteUrl.match(/(?:https?:\/\/)?7tv\.app\/emotes\/([a-zA-Z0-9]+)/)
        const emoteId = match ? match[1] : null

        if (emoteId) {
          try {
            const emote = await fetchSingular7tvEmote(emoteId)
            let cleanName = emote.name.replace(/[^\w\s]/g, '')
            cleanName = cleanName.padEnd(2, '_').slice(0, 32)
            const imageBuffer = await fetch7tvEmoteImageBuffer(emote)
            const discordEmote = await uploadEmoji(interaction.guild_id, env.DISCORD_TOKEN, cleanName, imageBuffer)
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Emote added: <${emote.animated ? 'a' : ''}:${cleanName}:${discordEmote.id}>` })
          }
          catch (error) {
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `${error}` })
          }
        }
      }
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
    }
    case 'help': {
      const embed = {
        title: '🥳 Emote Command Help',
        description: 'All commands and related information for the emote command',
        color: 0xFFF200,
        fields: [
          {
            name: '</emote add:1348421861339304067>',
            value: 'Add an emote from another discord server or 7tv',
          },
          {
            name: '</emote help:1348421861339304067>',
            value: 'Show this help message',
          },
          {
            name: 'Context Menu -> Apps -> Steal Emote',
            value: 'Use this option to take an emote directly from someone else\'s message and add it to your server',
          },
        ],

      } satisfies APIEmbed
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [embed] })
    }
  }

  return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
}

/**
 * Handles the /clips command.
 * @param interaction The interaction object from Discord
 * @param env The environment object
 * @returns A promise that resolves to nothing
 *
 * If the user provides a subcommand, the bot will handle it here.
 *
 * The subcommands are:
 * add: Adds a Twitch streamer to receive clip notifications when they go live or offline.
 * remove: Removes a Twitch streamer from receiving clip notifications.
 * edit: Edits the notification channel for a Twitch streamer.
 * list: Lists all the Twitch streamers you are subscribed to for clip notifications.
 * help: Shows this help message for clip notifications commands.
 */
async function handleTwitchClipsCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid interaction' })

  if (!interaction.data.options)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })

  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'This command can only be used in a server' })

  const option = interaction.data.options[0].name
  switch (option) {
    case 'add': {
      const server = interaction.guild_id
      const add = interaction.data.options.find(option => option.name === 'add')
      if (!add || !('options' in add) || !add.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })

      const streamerOption = add.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      const channelOption = add.options.find(option => option.name === 'discord-channel')
      const channel = channelOption && 'value' in channelOption ? channelOption.value as string : undefined

      if (!streamer || !channel)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })

      // check if we have permission to post in this discord channel
      const hasPermission = await checkChannelPermission(channel, env.DISCORD_TOKEN)
      if (!hasPermission)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'This bot does not have permission to post in this channel' })

      // check if already subscribed to this channel
      const subscriptions = await useDB(env).query.clips.findMany({
        where: (clips, { eq, and, like }) => and(eq(clips.guildId, server), like(clips.streamer, streamer)),
      })
      if (subscriptions.length > 0)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Already subscribed to this streamer' })

      // check if twitch channel exists
      const channelId = await getChannelId(streamer, env)
      if (!channelId)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find twitch channel' })

      const streamerDetails = await getStreamerDetails(streamer, env)

      // add to database
      await useDB(env).insert(tables.clips).values({
        streamer: streamerDetails ? streamerDetails.display_name : streamer,
        broadcasterId: channelId,
        guildId: server,
        channelId: channel,
      })

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Successfully subscribed to \`${streamerDetails ? streamerDetails.display_name : streamer}\` for clip notifications in <#${channel}>` })
    }
    case 'remove': {
      const remove = interaction.data.options.find(option => option.name === 'remove')
      if (!remove || !('options' in remove) || !remove.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamerOption = remove.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })

      const stream = await useDB(env).query.clips.findFirst({
        where: (clips, { and, eq, like }) => and(like(clips.streamer, streamer), eq(clips.guildId, interaction.guild_id)),
      })
      if (!stream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription for this streamer' })

      await useDB(env).delete(tables.clips).where(and(like(tables.clips.streamer, streamer), eq(tables.clips.guildId, interaction.guild_id)))

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Successfully unsubscribed to clip updates for **${streamer}**` })
    }
    case 'edit': {
      const server = interaction.guild_id
      const edit = interaction.data.options.find(option => option.name === 'edit')
      if (!edit || !('options' in edit) || !edit.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamerOption = edit.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const dbClip = await useDB(env).query.clips.findFirst({
        where: (clips, { and, eq, like }) => and(like(clips.streamer, streamer), eq(clips.guildId, interaction.guild_id)),
      })
      if (!dbClip)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription for this streamer' })

      const channel = edit.options.find(option => option.name === 'discord-channel')
      if (channel)
        await useDB(env).update(tables.clips).set({ channelId: String('value' in channel ? channel.value : '') }).where(and(like(tables.clips.streamer, streamer), eq(tables.clips.guildId, server)))

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Successfully edited notifications for **${streamer}**` })
    }
    case 'list': {
      const clips = await useDB(env).query.clips.findMany({
        where: (clips, { eq }) => eq(clips.guildId, interaction.guild_id),
      })
      let clipsList = 'Not subscribed to recive clip notifications for any streams'
      if (clips.length > 0)
        clipsList = clips.map(stream => `**${stream.streamer}** - <#${stream.channelId}>`).join('\n')

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: clipsList })
    }
    case 'help': {
      const embed = {
        title: '<a:CLIPPERS:1357111588644982997> Available Commands for Clip Notifications',
        description: '',
        color: 0x00EA5E9,
        fields: [
          {
            name: '/clips add <streamer> <discord-channel>',
            value: 'Add a Twitch streamer to receive clip notifications when they go live or offline.\n<streamer> - The name of the streamer to add\n<discord-channel> - The Discord channel to post to when the streamer goes live',
          },
          {
            name: '/clips remove <streamer>',
            value: 'Remove a Twitch streamer from receiving clip notifications.\n<streamer> - The name of the streamer to remove',
          },
          {
            name: '/clips edit <streamer> <discord-channel>',
            value: 'Edit the notification channel for a Twitch streamer.\n<streamer> - The name of the streamer to edit\n<discord-channel> - The new Discord channel to post notifications for the streamer',
          },
          {
            name: '/clips list',
            value: 'List all the Twitch streamers you are subscribed to for clip notifications.',
          },
          {
            name: '/clips help',
            value: 'Get this help message for clip notifications commands.',
          },
        ],
      }
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [embed] })
    }
  }
}
/**
 * Handle the /dinkdonk command.
 * @param env The environment object
 * @param interaction The interaction object from Discord
 * @returns A promise that resolves to nothing
 */
function handleDinkdonkCommand(env: Env, interaction: APIApplicationCommandInteraction) {
  return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: '<a:DinkDonk:1357111617787002962>' })
}

/**
 * Handles the steal emote context menu command.
 *
 * This function retrieves a message from Discord and attempts to steal
 * the first custom emote found in the message's content. If found, it
 * uploads the emote to the current Discord server.
 *
 * @param interaction The interaction object from Discord, containing the message data.
 * @param env The environment object containing configuration and authentication details.
 * @returns A promise that resolves to nothing. Updates the interaction with a success or error message.
 */

async function handleStealEmoteCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isContextMenuApplicationCommandInteraction(interaction))
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid interaction' })

  if (!isGuildInteraction(interaction))
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'This command can only be used in a server' })

  if (!interaction.data.resolved || !interaction.data.target_id)
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid interaction' })

  if (!('messages' in interaction.data.resolved)) {
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'This command can only be used on messages' })
  }

  const messageId = interaction.data.target_id
  const message = interaction.data.resolved?.messages[messageId]
  if (!message) {
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find the message to steal an emote from' })
  }
  const emote = message.content.match(/<a?:\w+:\d+>/)?.[0]

  if (!emote) {
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'No emote found in the message to steal.' })
  }

  if (emote.startsWith('<a:') || emote.startsWith('<:')) {
    const isAnimated = emote.startsWith('<a:')
    const content = isAnimated ? emote.slice(3, -1) : emote.slice(2, -1)
    const [name, id] = content.split(':')
    let cleanName = name.replace(/[^\w\s]/g, '')
    cleanName = cleanName.padEnd(2, '_').slice(0, 32)
    const extension = isAnimated ? 'gif' : 'png'
    const emoteUrl = `https://cdn.discordapp.com/emojis/${id}.${extension}`

    // try {
    //   // Check if the emote already exists in the guild
    //   const emojis = await fetchGuildEmojis(interaction.guild_id, env.DISCORD_TOKEN)
    //   if (emojis.some(emoji => emoji.id === id)) {
    //     return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `That emote is already from this server.` })
    //   }
    // }
    // catch (error) {
    //   console.error('Error checking if emote already exists:', error)
    // }

    try {
      const imageBuffer = await fetchEmoteImageBuffer(emoteUrl)
      const discordEmote = await uploadEmoji(interaction.guild_id, env.DISCORD_TOKEN, cleanName, imageBuffer)
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Emote added: <${isAnimated ? 'a' : ''}:${cleanName}:${discordEmote.id}>` })
    }
    catch (error) {
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `${error}` })
    }
  }

  return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Something went wrong stealing the emote' })
}

/**
 * Handles the /kick commands.
 * @param interaction The interaction object from Discord
 * @param env The environment object containing configuration and authentication details.
 * @returns A promise that resolves to nothing. Updates the interaction with a success or error message.
 */
async function handleKickCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid interaction' })
  if (!interaction.data.options)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'This command is only available in guilds' })
  const option = interaction.data.options[0].name
  switch (option) {
    case 'add': {
      const server = interaction.guild_id
      const add = interaction.data.options.find(option => option.name === 'add')
      if (!add || !('options' in add) || !add.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamerOption = add.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      const channelOption = add.options.find(option => option.name === 'discord-channel')
      const channel = channelOption && 'value' in channelOption ? channelOption.value as string : undefined
      const role = add.options.find(option => option.name === 'ping-role')
      const message = add.options.find(option => option.name === 'live-message')
      const offlineMessage = add.options.find(option => option.name === 'offline-message')
      // make sure we have all arguments
      if (!server || !streamer || !channel)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })

      // check if already subscribed to this channel
      const subscriptions = await useDB(env).query.kickStreams.findMany({
        where: (kickStreams, { eq, and, like }) => and(eq(kickStreams.guildId, server), like(kickStreams.name, streamer)),
      })
      if (subscriptions.length > 0)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'You have already subscribed to recieving notifications from this channel on this server' })

      // check if kick channel exists
      const kickChannel = await getKickChannel(streamer, env)
      if (!kickChannel)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find kick channel, make sure you have the correct name' })

      // check if we have permission to post in this discord channel
      const hasPermission = await checkChannelPermission(channel, env.DISCORD_TOKEN)
      if (!hasPermission)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'This bot does not have permission to post in this channel' })

      // subscribe to event sub for this channel
      const subscribed = await kickSubscribe(kickChannel.broadcaster_user_id, env)
      if (!subscribed)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Something went wrong while trying to subscribe to kick events' })

      let roleId: string | undefined
      if (role) {
        roleId = 'value' in role ? role.value as string : undefined
        if (roleId === server)
          roleId = undefined
      }

      const liveText = message && 'value' in message ? message.value as string : undefined
      const offlineText = offlineMessage && 'value' in offlineMessage ? offlineMessage.value as string : undefined

      // add to database
      await useDB(env).insert(tables.kickStreams).values({
        name: kickChannel ? kickChannel.slug : streamer,
        broadcasterId: String(kickChannel.broadcaster_user_id),
        guildId: server,
        channelId: channel,
        roleId,
        liveMessage: liveText,
        offlineMessage: offlineText,
      })

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Successfully subscribed to kick notifications for **${streamer}** in <#${channel}>` })
    }
    case 'remove': {
      const remove = interaction.data.options.find(option => option.name === 'remove')
      if (!remove || !('options' in remove) || !remove.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamerOption = remove.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const stream = await useDB(env).query.kickStreams.findFirst({
        where: (kickStreams, { eq, and, like }) => and(eq(kickStreams.guildId, interaction.guild_id), like(kickStreams.name, streamer)),
      })

      if (!stream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription' })

      await useDB(env).delete(tables.kickStreams).where(and(like(tables.kickStreams.name, streamer), eq(tables.kickStreams.guildId, interaction.guild_id)))
      const subscriptions = await useDB(env).query.kickStreams.findMany({
        where: (kickStreams, { like }) => like(kickStreams.name, streamer),
      })
      if (subscriptions.length === 0 && stream)
        await kickUnsubscribe(Number(stream.broadcasterId), env)

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Successfully unsubscribed to notifications for **${streamer}**` })
    }
    case 'edit':{
      const server = interaction.guild_id
      const edit = interaction.data.options.find(option => option.name === 'edit')
      if (!edit || !('options' in edit) || !edit.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamerOption = edit.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const dbStream = await useDB(env).query.kickStreams.findFirst({
        where: (kickStreams, { and, eq, like }) => and(like(kickStreams.name, streamer), eq(kickStreams.guildId, interaction.guild_id)),
      })
      if (!dbStream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription' })

      const channel = edit.options.find(option => option.name === 'discord-channel')
      if (channel)
        await useDB(env).update(tables.kickStreams).set({ channelId: String('value' in channel ? channel.value as string : '') }).where(and(like(tables.kickStreams.name, streamer), eq(tables.kickStreams.guildId, interaction.guild_id)))
      const role = edit.options.find(option => option.name === 'ping-role')
      let roleId: string | undefined
      if (role) {
        roleId = 'value' in role ? role.value as string : undefined
        if (roleId === server)
          roleId = undefined
      }
      if (roleId)
        await useDB(env).update(tables.kickStreams).set({ roleId }).where(and(like(tables.kickStreams.name, streamer), eq(tables.kickStreams.guildId, interaction.guild_id)))

      const message = edit.options.find(option => option.name === 'live-message')
      if (message)
        await useDB(env).update(tables.kickStreams).set({ liveMessage: 'value' in message ? message.value as string : '' }).where(and(like(tables.kickStreams.name, streamer), eq(tables.kickStreams.guildId, interaction.guild_id)))

      const offlineMessage = edit.options.find(option => option.name === 'offline-message')
      if (offlineMessage)
        await useDB(env).update(tables.kickStreams).set({ offlineMessage: 'value' in offlineMessage ? offlineMessage.value as string : '' }).where(and(like(tables.kickStreams.name, streamer), eq(tables.kickStreams.guildId, interaction.guild_id)))

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Successfully edited notifications for **${streamer}**` })
    }
    case 'list': {
      const streams = await useDB(env).query.kickStreams.findMany({
        where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id),
      })
      let streamList = 'Not subscribed to any kick streams'
      if (streams.length > 0)
        streamList = streams.map(stream => `**${stream.name}** - <#${stream.channelId}>`).join('\n')

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: streamList })
    }
    case 'test':{
      const test = interaction.data.options.find(option => option.name === 'test')
      if (!test || !('options' in test) || !test.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamerOption = test.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const global = test.options.find(option => option.name === 'global')
      const stream = await useDB(env).query.kickStreams.findFirst({
        where: (kickStreams, { and, eq, like }) => and(like(kickStreams.name, streamer), eq(kickStreams.guildId, interaction.guild_id)),
      })
      if (!stream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription' })

      const [kickUser, kickLivestream] = await Promise.all([
        await getKickChannelV2(stream.name),
        await getKickLivestream(Number(stream.broadcasterId), env),
      ])

      // build a fake stream message object
      const streamMessage = {
        id: 0,
        streamId: null,
        kickStream: stream,
        kickStreamId: null,
        kickStreamStartedAt: new Date(),
        kickStreamEndedAt: null,
        twitchStreamStartedAt: null,
        twitchStreamEndedAt: null,
        discordChannelId: stream.channelId,
        discordMessageId: null,
        twitchStreamId: null,
        twitchOnline: true,
        twitchStreamData: null,
        twitchStreamerData: null,
        twitchVod: null,
        kickStreamData: kickLivestream ?? null,
        kickStreamerData: kickUser ?? null,
        kickVod: null,
        kickOnline: true,
        createdAt: new Date().toISOString(),
      } satisfies StreamMessage

      const body = bodyBuilder(streamMessage, env)
      if (global) {
        if ('value' in global && global.value === 'true') {
          await sendMessage(stream.channelId, env.DISCORD_TOKEN, body, env)
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Successfully sent test message for **${streamer}**` })
        }
        else {
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, body)
        }
      }
      else {
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, body)
      }
    }
    case 'details': {
      const details = interaction.data.options.find(option => option.name === 'details')
      if (!details || !('options' in details) || !details.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamerOption = details.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const stream = await useDB(env).query.kickStreams.findFirst({
        where: (kickStreams, { and, eq, like }) => and(like(kickStreams.name, streamer), eq(kickStreams.guildId, interaction.guild_id)),
      })
      if (!stream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription to his channel' })
      let message = `Streamer: \`${stream.name}\`\n`
      message += `Channel: <#${stream.channelId}>\n`
      message += `Live Message: \`${stream.liveMessage}\`\n`
      message += `Offline Message: \`${stream.offlineMessage}\`\n`
      if (stream.roleId)
        message += `\n Role: <@&${stream.roleId}>`

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: message })
    }
    case 'help': {
      const embed = {
        title: '<:kick:1404661261030916246> Available commands',
        description: '',
        color: 0x53FC18,
        fields: [
          {
            name: '</kick add:1398833401888378910> <streamer> <discord-channel> <ping-role> <live-message> <offline-message>',
            value: 'Add a Kick streamer to receive notifications for going online or offline\n<streamer> - The name of the streamer to add \n<discord-channel> - The Discord channel to post to when the streamer goes live\n<ping-role> - What role to @ when the streamer goes live\n<live-message> - The message to post when the streamer goes live\n<offline-message> - The message to post when the streamer goes offline',
          },
          {
            name: '</kick edit:1398833401888378910><streamer> <discord-channel> <ping-role> <live-message> <offline-message>',
            value: 'Edit a Kick streamer\'s settings\n<streamer> - The name of the streamer to edit \n<discord-channel> - The Discord channel to post to when the streamer goes live\n<ping-role> - What role to @ when the streamer goes live\n<live-message> - The message to post when the streamer goes live\n<offline-message> - The message to post when the streamer goes offline',
          },
          {
            name: '</kick remove:1398833401888378910> <streamer>',
            value: 'Remove a Kick streamer from receiving notifications for going online or offline\n<streamer> - The name of the streamer to remove',
          },
          {
            name: '</kick list:1398833401888378910>',
            value: 'List the Kick streamers that you are subscribed to',
          },
          {
            name: '</kick test:1398833401888378910> <streamer> <global>',
            value: 'Test the notification for a streamer\n<streamer> - The name of the streamer to test\n<global> - Whether to send the message to everyone or not',
          },
          {
            name: '</kick details:1398833401888378910> <streamer>',
            value: 'Show the details for a streamer you are subscribed to\n<streamer> - The name of the streamer to show',
          },
          {
            name: '</kick help:1398833401888378910>',
            value: 'Get this help message',
          },
          {
            name: 'Message variables',
            value: '```{{name}} = the name of the streamer\n{{url}} = the url for the stream\n{{everyone}} = @everyone\n{{here}} = @here\n{{game}} or {{category}} = the game or category of the stream - only works on live message\n{{timestamp}} = the time the stream started/ended\n```',
          },

        ],
      }
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [embed] })
    }
  }

  return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Command not yet implemented' })
}
async function handleHelpCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  const embed = {
    title: 'DinkDonk Bot Help',
    description: 'All commands and related information for DinkDonk Bot',
    color: 0xFFF200,
    thumbnail: {
      url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
    },
    fields: [
      {
        name: '<:twitch:1404661243373031585> Twitch Stream Alerts',
        value: 'Use </twitch help:1227872472049782919> to get help for Twitch notifications',
      },
      {
        name: '<:kick:1404661261030916246> Kick Stream Alerts',
        value: 'Use </kick help:1398833401888378910> to get help for Kick notifications',
      },
      {
        name: '📺 Multistream Alerts',
        value: 'If you subscribe to a Twitch and Kick streamer of the same name and in the same discord channel, they will be merged into one message to help reduce spam',
      },
      {
        name: '<a:CLIPPERS:1357111588644982997> Twitch Clips',
        value: 'Use </clips help:1348090120418361426> to get help for Twitch clips notifications',
      },
      {
        name: '🥳 Emote Management',
        value: 'Use </emote help:1348421861339304067> to get help for emote commands',
      },
      {
        name: '❓ Support',
        value: 'If you have any issues open a [GitHub issue](https://github.com/svglol/dinkdonkbot/issues/new/choose).',
      },
      {
        name: '🔗 Links',
        value: '[Website](https://svglol.github.io/dinkdonkbot/) | [GitHub](https://github.com/svglol/dinkdonkbot)',
      },
    ],
  } satisfies APIEmbed
  return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [embed] })
}
