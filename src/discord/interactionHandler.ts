import { and, eq, like } from 'drizzle-orm'
import { tables, useDB } from '../database/db'
import { getChannelId, getStreamDetails, getStreamerDetails, removeSubscription, subscribe } from '../twitch/twitch'
import { fetch7tvEmoteImageBuffer, fetchEmoteImageBuffer, fetchSingular7tvEmote } from '../util/emote'
import * as commands from './commands'
import { liveBodyBuilder, sendMessage, updateInteraction, uploadEmoji } from './discord'

/**
 * This function is called whenever a user interacts with the bot,
 * whether that be through a slash command or an interaction with the bot.
 * It is responsible for handling all of the different interactions and
 * responding to the user accordingly.
 * @param interaction The interaction object as provided by Discord.
 * @param env The environment object as provided by the caller.
 * @returns A promise that resolves to nothing.
 */
export async function discordInteractionHandler(interaction: DiscordInteraction, env: Env) {
  if (!interaction.data)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid interaction' })

  switch (interaction.data.name.toLowerCase()) {
    case commands.EMOTE_COMMAND.name.toLowerCase(): {
      return handleEmoteCommand(interaction, env)
    }
    case commands.TWITCH_CLIPS_COMMAND.name.toLowerCase(): {
      return handleTwitchClipsCommand(interaction, env)
    }
    case commands.INVITE_COMMAND.name.toLowerCase(): {
      return handleInviteCommand(env, interaction)
    }
    case commands.TWITCH_COMMAND.name.toLowerCase(): {
      return handleTwitchCommand(interaction, env)
    }
  }
}

/**
 * This function is called when a user interacts with the /twitch command.
 * It will add a streamer to the list of streamers that will be notified
 * when they go live or offline.
 * @param interaction The interaction object as provided by Discord.
 * @param env The environment object as provided by the caller.
 * @returns A promise that resolves to nothing.
 */
async function handleTwitchCommand(interaction: DiscordInteraction, env: Env) {
  if (!interaction.data)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid interaction' })
  if (!interaction.data.options)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
  const option = interaction.data.options[0].name
  switch (option) {
    case 'add': {
      const server = interaction.guild_id
      const add = interaction.data.options.find(option => option.name === 'add') as DiscordSubCommand
      if (!add || !add.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamer = add.options.find(option => option.name === 'streamer')?.value as string
      const channel = add.options.find(option => option.name === 'discord-channel')?.value as string
      const role = add.options.find(option => option.name === 'ping-role')
      const message = add.options.find(option => option.name === 'live-message')
      const offlineMessage = add.options.find(option => option.name === 'offline-message')
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

      // subscribe to event sub for this channel
      const subscribed = await subscribe(channelId, env)
      if (!subscribed)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not subscribe to this twitch channel' })

      let roleId: string | undefined
      if (role) {
        roleId = role.value as string
        if (roleId === server)
          roleId = undefined
      }

      const liveText = message ? message.value as string : undefined
      const offlineText = offlineMessage ? offlineMessage.value as string : undefined

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
      const remove = interaction.data.options.find(option => option.name === 'remove') as DiscordSubCommand
      if (!remove || !remove.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamer = remove.options.find(option => option.name === 'streamer')?.value as string
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
      const edit = interaction.data.options.find(option => option.name === 'edit') as DiscordSubCommand
      if (!edit || !edit.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamer = edit.options.find(option => option.name === 'streamer')?.value as string
      const dbStream = await useDB(env).query.streams.findFirst({
        where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
      })
      if (!dbStream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription' })

      const channel = edit.options.find(option => option.name === 'discord-channel')
      if (channel)
        await useDB(env).update(tables.streams).set({ channelId: String(channel.value) }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))
      const role = edit.options.find(option => option.name === 'ping-role')
      let roleId: string | undefined
      if (role) {
        roleId = role.value as string
        if (roleId === server)
          roleId = undefined
      }
      if (roleId)
        await useDB(env).update(tables.streams).set({ roleId }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))

      const message = edit.options.find(option => option.name === 'live-message')
      if (message)
        await useDB(env).update(tables.streams).set({ liveMessage: message.value as string }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))

      const offlineMessage = edit.options.find(option => option.name === 'offline-message')
      if (offlineMessage)
        await useDB(env).update(tables.streams).set({ offlineMessage: offlineMessage.value as string }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))

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
      const test = interaction.data.options.find(option => option.name === 'test') as DiscordSubCommand
      if (!test || !test.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamer = test.options.find(option => option.name === 'streamer')?.value as string
      const global = test.options.find(option => option.name === 'global')
      const stream = await useDB(env).query.streams.findFirst({
        where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
      })
      if (!stream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription' })

      const [streamerData, streamData] = await Promise.all([
        getStreamerDetails(stream.name, env),
        getStreamDetails(stream.name, env),
      ])
      const body = liveBodyBuilder({ sub: stream, streamerData, streamData })
      if (global) {
        if (global.value as boolean) {
          await sendMessage(stream.channelId, env.DISCORD_TOKEN, body)
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
      const details = interaction.data.options.find(option => option.name === 'details') as DiscordSubCommand
      if (!details || !details.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamer = details.options.find(option => option.name === 'streamer')?.value as string
      const stream = await useDB(env).query.streams.findFirst({
        where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
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
        title: 'Available commands',
        description: '',
        color: 0x00EA5E9,
        fields: [
          {
            name: '/twitch add <streamer> <discord-channel> <ping-role> <live-message> <offline-message>',
            value: 'Add a Twitch streamer to receive notifications for going online or offline\n<streamer> - The name of the streamer to add \n<discord-channel> - The discord channel to post to when the streamer goes live\n<ping-role> - What role to @ when the streamer goes live\n<live-message> - The message to post when the streamer goes live\n<offline-message> - The message to post when the streamer goes offline',
          },
          {
            name: '/twitch edit <streamer> <discord-channel> <ping-role> <live-message> <offline-message>',
            value: 'Edit a Twitch streamer\'s settings\n<streamer> - The name of the streamer to edit \n<discord-channel> - The discord channel to post to when the streamer goes live\n<ping-role> - What role to @ when the streamer goes live\n<live-message> - The message to post when the streamer goes live\n<offline-message> - The message to post when the streamer goes offline',
          },
          {
            name: '/twitch remove <streamer>',
            value: 'Remove a Twitch streamer from receiving notifications for going online or offline\n<streamer> - The name of the streamer to remove',
          },
          {
            name: '/twitch list',
            value: 'List the twitch streamers that you are subscribed to',
          },
          {
            name: '/twitch test <streamer> <global>',
            value: 'Test the notification for a streamer \n<streamer> - The name of the streamer to test \n<global> - Whether to send the message to everyone or not',
          },
          {
            name: '/twitch details <streamer>',
            value: 'Show the details for a streamer you are subscribed to\n<streamer> - The name of the streamer to show',
          },
          {
            name: '/twitch help',
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
async function handleInviteCommand(env: Env, interaction: DiscordInteraction) {
  const applicationId = env.DISCORD_APPLICATION_ID
  const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${applicationId}&permissions=8797166895104&scope=applications.commands+bot`
  return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: INVITE_URL })
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
async function handleEmoteCommand(interaction: DiscordInteraction, env: Env) {
  if (!interaction.data)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid interaction' })

  if (!interaction.data.options) {
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
  }

  const options = interaction.data.options as DiscordInteractionOption[]
  if (!options[0]) {
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
  }

  const emote = options.find(option => option.name === 'url_or_emoji')?.value as string
  const is7tvLink = /^https?:\/\/7tv\.app\/emotes\/[a-zA-Z0-9]+$/.test(emote)

  if (emote.startsWith('<a:') || emote.startsWith('<:')) {
    const isAnimated = emote.startsWith('<a:')
    const content = isAnimated ? emote.slice(3, -1) : emote.slice(2, -1)
    const [name, id] = content.split(':')
    const extension = isAnimated ? 'gif' : 'png'
    const emoteUrl = `https://cdn.discordapp.com/emojis/${id}.${extension}`

    const imageBuffer = await fetchEmoteImageBuffer(emoteUrl)
    if (!imageBuffer) {
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Failed to fetch emote image' })
    }

    const discordEmote = await uploadEmoji(interaction.guild_id, env.DISCORD_TOKEN, name, imageBuffer)
    if (discordEmote && discordEmote.id) {
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Emote added: <${isAnimated ? 'a' : ''}:${name}:${discordEmote.id}>` })
    }
    else {
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Failed to upload emote' })
    }
  }

  if (is7tvLink) {
    const emoteUrl = emote
    const match = emoteUrl.match(/(?:https?:\/\/)?7tv\.app\/emotes\/([a-zA-Z0-9]+)/)
    const emoteId = match ? match[1] : null

    if (emoteId) {
      const emote = await fetchSingular7tvEmote(emoteId)
      if (emote) {
        const imageBuffer = await fetch7tvEmoteImageBuffer(emote)
        if ('error' in imageBuffer) {
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `${imageBuffer.error}` })
        }

        const discordEmote = await uploadEmoji(interaction.guild_id, env.DISCORD_TOKEN, emote.name, imageBuffer)
        if (discordEmote && discordEmote.id) {
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `Emote added: <${emote.animated ? 'a' : ''}:${emote.name}:${discordEmote.id}>` })
        }
        else {
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Failed to upload emote' })
        }
      }
      else {
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Failed to fetch emote from 7tv' })
      }
    }
    else {
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
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
async function handleTwitchClipsCommand(interaction: DiscordInteraction, env: Env) {
  if (!interaction.data)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid interaction' })

  if (!interaction.data.options)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })

  const option = interaction.data.options[0].name
  switch (option) {
    case 'add': {
      const server = interaction.guild_id
      const add = interaction.data.options.find(option => option.name === 'add') as DiscordSubCommand
      if (!add || !add.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })

      const streamer = add.options.find(option => option.name === 'streamer')?.value as string
      const channel = add.options.find(option => option.name === 'discord-channel')?.value as string

      if (!streamer || !channel)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })

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
      const remove = interaction.data.options.find(option => option.name === 'remove') as DiscordSubCommand
      if (!remove || !remove.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamer = remove.options.find(option => option.name === 'streamer')?.value as string
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
      const edit = interaction.data.options.find(option => option.name === 'edit') as DiscordSubCommand
      if (!edit || !edit.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Invalid arguments' })
      const streamer = edit.options.find(option => option.name === 'streamer')?.value as string
      const dbClip = await useDB(env).query.clips.findFirst({
        where: (clips, { and, eq, like }) => and(like(clips.streamer, streamer), eq(clips.guildId, interaction.guild_id)),
      })
      if (!dbClip)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: 'Could not find subscription for this streamer' })

      const channel = edit.options.find(option => option.name === 'discord-channel')
      if (channel)
        await useDB(env).update(tables.clips).set({ channelId: String(channel.value) }).where(and(like(tables.clips.streamer, streamer), eq(tables.clips.guildId, server)))

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
        title: 'Available Commands for Clip Notifications',
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
