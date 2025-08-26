import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import type { StreamMessage } from '../../database/db'
import { isChatInputApplicationCommandInteraction, isGuildInteraction } from 'discord-api-types/utils'
import { PermissionFlagsBits } from 'discord-api-types/v10'
import { and, eq, like } from 'drizzle-orm'
import { tables, useDB } from '../../database/db'
import { getKickChannel, getKickChannelV2, getKickLatestVod, getKickLivestream, getKickUser, kickSubscribe, kickUnsubscribe } from '../../kick/kick'
import { getLatestVOD, getStreamDetails, getStreamerDetails } from '../../twitch/twitch'
import { KICK_EMOTE, TWITCH_EMOTE } from '../../util/discordEmotes'
import { bodyBuilder, buildErrorEmbed, buildSuccessEmbed, checkChannelPermission, findBotCommandMarkdown, sendMessage, updateInteraction } from '../discord'
import { autoCompleteResponse, interactionEphemeralLoading } from '../interactionHandler'

const KICK_COMMAND = {
  name: 'kick',
  description: 'Kick Stream Notifications',
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  dm_permission: false,
  options: [
    {
      type: 1,
      name: 'add',
      description: 'Add a Kick streamer to receive notifications for going online',
      dm_permission: false,
      options: [{
        type: 3,
        name: 'streamer',
        description: 'The name of the streamer to add',
        required: true,
      }, {
        type: 7,
        name: 'discord-channel',
        description: 'The discord channel to post to when the streamer goes live',
        required: true,
        channel_types: [0],
      }, {
        type: 8,
        name: 'ping-role',
        description: 'What role to @ when the streamer goes live',
      }, {
        type: 3,
        name: 'live-message',
        description: 'The message to post when the streamer goes live',
      }, {
        type: 3,
        name: 'offline-message',
        description: 'The message to post when the streamer goes offline',
      }, {
        type: 5,
        name: 'cleanup',
        description: 'Remove notification after the streamer goes offline',
      }],
    },
    {
      type: 1,
      name: 'remove',
      description: 'Remove a Kick streamer from receiving notifications for going online',
      dm_permission: false,
      options: [{
        type: 3,
        name: 'streamer',
        description: 'The name of the streamer to remove',
        required: true,
        autocomplete: true,
      }],
    },
    {
      type: 1,
      name: 'list',
      description: 'View your subscribed Kick streamers',
      dm_permission: false,
    },
    {
      type: 1,
      name: 'help',
      description: 'Show help for the kick command',
      dm_permission: false,
    },
    {
      type: 1,
      name: 'details',
      description: 'Show the details for a streamer you are subscribed to',
      dm_permission: false,
      options: [{
        type: 3,
        name: 'streamer',
        description: 'The name of the streamer to show',
        required: true,
        autocomplete: true,
      }],
    },
    {
      type: 1,
      name: 'edit',
      description: 'Edit a Kick streamer\'s settings',
      dm_permission: false,
      options: [{
        type: 3,
        name: 'streamer',
        description: 'The name of the streamer to edit',
        required: true,
        autocomplete: true,
      }, {
        type: 7,
        name: 'discord-channel',
        description: 'The discord channel to post to when the streamer goes live',
        channel_types: [0],
      }, {
        type: 8,
        name: 'ping-role',
        description: 'What role/who to @ when the streamer goes live',
      }, {
        type: 3,
        name: 'live-message',
        description: 'The message to post when the streamer goes live',
      }, {
        type: 3,
        name: 'offline-message',
        description: 'The message to post when the streamer goes offline',
      }, {
        type: 5,
        name: 'cleanup',
        description: 'Remove notification after the streamer goes offline',
      }],
    },
    {
      type: 1,
      name: 'test',
      description: 'Test the notification for a streamer',
      dm_permission: false,
      options: [{
        type: 3,
        name: 'streamer',
        description: 'The name of the streamer to test',
        required: true,
        autocomplete: true,
      }, {
        type: 3,
        name: 'message-type',
        description: 'Whether to test the live or offline message',
        choices: [
          { name: 'Online', value: 'live' },
          { name: 'Offline', value: 'offline' },
        ],
      }, {
        type: 5,
        name: 'multistream',
        description: 'Show the notification as if it was a multistream (only works if you have a multistream setup)',
      }, {
        type: 5,
        name: 'global',
        description: 'Show the notification for everyone in the server',
      }],
    },
  ],
}

export async function getKickHelpMessage(env: Env) {
  return `Set up Kick stream notifications for your Discord server. Get notified when your favorite streamers go live or offline with customizable messages and ping roles.
- ${await findBotCommandMarkdown(env, 'kick', 'add')} <streamer> <discord-channel> <ping-role> <live-message> <offline-message> <cleanup> - Add a Kick streamer to receive notifications for going online or offline
- ${await findBotCommandMarkdown(env, 'kick', 'edit')} <streamer> <discord-channel> <ping-role> <live-message> <offline-message> <cleanup> - Edit a Kick streamer’s settings  
- ${await findBotCommandMarkdown(env, 'kick', 'remove')} <streamer> - Remove a Kick streamer from receiving notifications for going online or offline  
- ${await findBotCommandMarkdown(env, 'kick', 'list')} - List the Kick streamers that you are subscribed to  
- ${await findBotCommandMarkdown(env, 'kick', 'test')} <streamer> <global> <message-type> <multistream> - Test the notification for a streamer
- ${await findBotCommandMarkdown(env, 'kick', 'details')} <streamer> - Show the details for a streamer you are subscribed to  
- ${await findBotCommandMarkdown(env, 'kick', 'help')} - Get this help message  

**Command variables**
> \`<streamer>\` – The name of the streamer to add  
> \`<discord-channel>\` – The Discord channel to post to when the streamer goes live  
> \`<ping-role>\` – What role to @ when the streamer goes live  
> \`<live-message>\` – The message to post when the streamer goes live  
> \`<offline-message>\` – The message to post when the streamer goes offline  
> \`<cleanup>\` – Delete notifications once the streamer goes offline  
> \`<message-type>\` - Whether to test the live or offline message
> \`<multistream>\` - Show the notification as if it was a multistream (only works if you have a multistream setup)
> \`<global>\` - Show the notification for everyone in the server

**Message variables**  
> \`{{name}}\` = the name of the streamer
> \`{{url}}\` = the url for the stream
> \`{{everyone}}\` = @everyone
> \`{{here}}\` = @here
> \`{{game}}/{{category}}\` = the game or category of the stream (live only)
> \`{{timestamp}}\` = the time the stream started/ended
`
}

function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleKickCommand(interaction, env))
  return interactionEphemeralLoading()
}

/**
 * Handles the /kick commands.
 * @param interaction The interaction object from Discord
 * @param env The environment object containing configuration and authentication details.
 * @returns A promise that resolves to nothing. Updates the interaction with a success or error message.
 */
async function handleKickCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  if (!interaction.data.options)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })
  const option = interaction.data.options[0].name
  switch (option) {
    case 'add': {
      const server = interaction.guild_id
      const add = interaction.data.options.find(option => option.name === 'add')
      if (!add || !('options' in add) || !add.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
      const streamerOption = add.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      const channelOption = add.options.find(option => option.name === 'discord-channel')
      const channel = channelOption && 'value' in channelOption ? channelOption.value as string : undefined
      const role = add.options.find(option => option.name === 'ping-role')
      const message = add.options.find(option => option.name === 'live-message')
      const offlineMessage = add.options.find(option => option.name === 'offline-message')

      const cleanupOption = add.options.find(option => option.name === 'cleanup')
      const cleanup = cleanupOption && 'value' in cleanupOption ? cleanupOption.value as boolean : false
      // make sure we have all arguments
      if (!server || !streamer || !channel)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Missing required arguments', env)] })

      // check if already subscribed to this channel
      const subscriptions = await useDB(env).query.kickStreams.findMany({
        where: (kickStreams, { eq, and, like }) => and(eq(kickStreams.guildId, server), like(kickStreams.name, streamer)),
      })
      if (subscriptions.length > 0)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`You're already subscribed to notifications for \`${streamer}\` on this server`, env)] })

      // check if kick channel exists
      const kickChannel = await getKickChannel(streamer, env)
      if (!kickChannel)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`Kick channel with name:\`${streamer}\` could not be found`, env)] })

      const kickUser = await getKickUser(Number(kickChannel.broadcaster_user_id), env)

      // check if we have permission to post in this discord channel
      const hasPermission = await checkChannelPermission(channel, env.DISCORD_TOKEN)
      if (!hasPermission)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`Dinkdonk Bot does not have the required permissions to post in <#${channel}>`, env)] })

      // subscribe to event sub for this channel
      const subscribed = await kickSubscribe(kickChannel.broadcaster_user_id, env)
      if (!subscribed)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Something went wrong while trying to subscribe to kick events', env)] })

      let roleId: string | undefined
      if (role) {
        roleId = 'value' in role ? role.value as string : undefined
        if (roleId === server)
          roleId = undefined
      }

      const liveText = message && 'value' in message ? message.value as string : undefined
      const offlineText = offlineMessage && 'value' in offlineMessage ? offlineMessage.value as string : undefined

      // add to database
      const subscription = await useDB(env).insert(tables.kickStreams).values({
        name: kickUser ? kickUser.name : streamer,
        broadcasterId: String(kickChannel.broadcaster_user_id),
        guildId: server,
        channelId: channel,
        roleId,
        liveMessage: liveText,
        offlineMessage: offlineText,
        cleanup,
      }).returning().get()

      if (!subscription)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Something went wrong while trying to subscribe to kick events', env)] })

      // check if we can automatically make a multi-stream
      const stream = await useDB(env).query.streams.findFirst({
        where: (streams, { eq, and, like }) => and(eq(streams.channelId, channel), like(streams.name, streamer)),
        with: { multiStream: true },
      })
      if (stream && !stream.multiStream) {
        await useDB(env).insert(tables.multiStream).values({
          streamId: stream.id,
          kickStreamId: subscription.id,
        })
      }

      let details = `Streamer: \`${subscription.name}\`\n`
      details += `Channel: <#${subscription.channelId}>\n`
      details += `Live Message: \`${subscription.liveMessage}\`\n`
      details += `Offline Message: \`${subscription.offlineMessage}\`\n`
      details += `Cleanup: \`${subscription.cleanup}\`\n`
      if (subscription.roleId)
        details += `\n Role: <@&${subscription.roleId}>`
      if (stream && !stream.multiStream)
        details += `\nAutomatically made a multi-stream link with Twitch Stream: ${TWITCH_EMOTE.formatted} \`${stream.name}\`\n`

      const kickChannelV2 = await getKickChannelV2(streamer)

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(details, env, {
        title: `${KICK_EMOTE.formatted} Subscribed to notifications for \`${subscription.name}\``,
        ...(kickChannelV2?.user.profile_pic && {
          thumbnail: { url: kickChannelV2.user.profile_pic },
        }),
      })] })
    }
    case 'remove': {
      const remove = interaction.data.options.find(option => option.name === 'remove')
      if (!remove || !('options' in remove) || !remove.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
      const streamerOption = remove.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Missing required arguments', env)] })
      const stream = await useDB(env).query.kickStreams.findFirst({
        where: (kickStreams, { eq, and, like }) => and(eq(kickStreams.guildId, interaction.guild_id), like(kickStreams.name, streamer)),
      })

      if (!stream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })

      await useDB(env).delete(tables.kickStreams).where(and(like(tables.kickStreams.name, streamer), eq(tables.kickStreams.guildId, interaction.guild_id)))
      const subscriptions = await useDB(env).query.kickStreams.findMany({
        where: (kickStreams, { like }) => like(kickStreams.name, streamer),
      })
      if (subscriptions.length === 0 && stream)
        await kickUnsubscribe(Number(stream.broadcasterId), env)

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(`Unsubscribed to notifications for **${streamer}**`, env)] })
    }
    case 'edit':{
      const server = interaction.guild_id
      const edit = interaction.data.options.find(option => option.name === 'edit')
      if (!edit || !('options' in edit) || !edit.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
      const streamerOption = edit.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Missing required arguments', env)] })
      const dbStream = await useDB(env).query.kickStreams.findFirst({
        where: (kickStreams, { and, eq, like }) => and(like(kickStreams.name, streamer), eq(kickStreams.guildId, interaction.guild_id)),
      })
      if (!dbStream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })

      const channel = edit.options.find(option => option.name === 'discord-channel')
      if (channel) {
        const hasPermission = await checkChannelPermission(String('value' in channel ? channel.value as string : ''), env.DISCORD_TOKEN)
        if (hasPermission) {
          await useDB(env).update(tables.kickStreams).set({ channelId: String('value' in channel ? channel.value as string : '') }).where(and(like(tables.kickStreams.name, streamer), eq(tables.kickStreams.guildId, interaction.guild_id)))
        }
        else {
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This bot does not have permission to send messages in this channel', env)] })
        }
      }
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

      const cleanup = edit.options.find(option => option.name === 'cleanup')
      if (cleanup) {
        const cleanupValue = 'value' in cleanup ? Boolean(cleanup.value) : false
        await useDB(env).update(tables.kickStreams).set({ cleanup: cleanupValue }).where(and(like(tables.kickStreams.name, streamer), eq(tables.kickStreams.guildId, interaction.guild_id)))
      }

      // get up to date sub
      const subscription = await useDB(env).query.kickStreams.findFirst({
        where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
      })
      if (!subscription)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })

      let details = `Streamer: \`${subscription.name}\`\n`
      details += `Channel: <#${subscription.channelId}>\n`
      details += `Live Message: \`${subscription.liveMessage}\`\n`
      details += `Offline Message: \`${subscription.offlineMessage}\`\n`
      details += `Cleanup: \`${subscription.cleanup}\`\n`
      if (subscription.roleId)
        details += `\n Role: <@&${subscription.roleId}>`

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(`${details}`, env, { title: `${KICK_EMOTE.formatted} Edited notifications for \`${streamer}\`` })] })
    }
    case 'list': {
      const streams = await useDB(env).query.kickStreams.findMany({
        where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id),
      })
      let streamList = 'Not subscribed to any kick streams'
      if (streams.length > 0)
        streamList = streams.map(stream => `**${stream.name}** - <#${stream.channelId}>`).join('\n')

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(`${streamList}`, env, { title: `${KICK_EMOTE.formatted} Kick Streams` })] })
    }
    case 'test':{
      const test = interaction.data.options.find(option => option.name === 'test')
      if (!test || !('options' in test) || !test.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
      const streamerOption = test.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Missing required arguments', env)] })
      const global = test.options.find(option => option.name === 'global')
      const stream = await useDB(env).query.kickStreams.findFirst({
        where: (kickStreams, { and, eq, like }) => and(like(kickStreams.name, streamer), eq(kickStreams.guildId, interaction.guild_id)),
        with: {
          multiStream: { with: {
            stream: true,
          } },
        },
      })
      if (!stream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })

      const messageTypeOption = test.options.find(option => option.name === 'message-type')
      const messageType = messageTypeOption && 'value' in messageTypeOption ? messageTypeOption.value as string : 'live'

      const multiStreamOption = test.options.find(option => option.name === 'multistream')
      const multiStream = multiStreamOption && 'value' in multiStreamOption ? Boolean(multiStreamOption.value) && stream.multiStream : false

      const [kickUser, kickLivestream] = await Promise.all([
        await getKickChannelV2(stream.name),
        await getKickLivestream(Number(stream.broadcasterId), env),
      ])

      let twitchStreamData: TwitchStream | null = null
      let twitchStreamerData: TwitchUser | null = null
      if (multiStream) {
        [twitchStreamerData, twitchStreamData] = await Promise.all([
          getStreamerDetails(stream.multiStream.stream.name, env),
          getStreamDetails(stream.multiStream.stream.name, env),
        ])
      }

      const kickVod = messageType === 'live' ? null : await getKickLatestVod(kickLivestream?.started_at || new Date().toISOString(), stream.name)
      const twitchVod = multiStream ? messageType === 'live' ? null : await getLatestVOD(stream.multiStream.stream.broadcasterId, twitchStreamData?.id || '', env) : null

      // build a fake stream message object
      const streamMessage = {
        id: 0,
        stream: multiStream ? stream.multiStream.stream : null,
        streamId: null,
        kickStream: stream,
        kickStreamId: null,
        kickStreamStartedAt: messageType === 'live' ? new Date(kickLivestream?.started_at || new Date()) : new Date(new Date(kickLivestream?.started_at || new Date()).getTime() - 3600000),
        kickStreamEndedAt: messageType === 'live' ? null : new Date(),
        twitchStreamStartedAt: messageType === 'live' ? new Date(twitchStreamData?.started_at || new Date()) : new Date(new Date(twitchStreamData?.started_at || new Date()).getTime() - 3600000),
        twitchStreamEndedAt: messageType === 'live' ? null : new Date(),
        discordChannelId: stream.channelId,
        discordMessageId: null,
        twitchStreamId: null,
        twitchOnline: multiStream ? messageType === 'live' : false,
        twitchStreamData: twitchStreamData ?? null,
        twitchStreamerData: twitchStreamerData ?? null,
        twitchVod: twitchVod ?? null,
        kickStreamData: kickLivestream ?? null,
        kickStreamerData: kickUser ?? null,
        kickVod,
        kickOnline: messageType === 'live',
        createdAt: new Date().toISOString(),
      } satisfies StreamMessage

      const body = bodyBuilder(streamMessage, env)
      if (global) {
        if ('value' in global && global.value === true) {
          await sendMessage(stream.channelId, env.DISCORD_TOKEN, body, env)
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(`Sent test message for **${streamer}**`, env)] })
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
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
      const streamerOption = details.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Missing required arguments', env)] })
      const stream = await useDB(env).query.kickStreams.findFirst({
        where: (kickStreams, { and, eq, like }) => and(like(kickStreams.name, streamer), eq(kickStreams.guildId, interaction.guild_id)),
        with: {
          multiStream: { with: { stream: true } },
        },
      })
      if (!stream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })
      let message = `Streamer: \`${stream.name}\`\n`
      message += `Channel: <#${stream.channelId}>\n`
      message += `Live Message: \`${stream.liveMessage}\`\n`
      message += `Offline Message: \`${stream.offlineMessage}\`\n`
      message += `Cleanup: \`${stream.cleanup}\`\n`
      if (stream.roleId)
        message += `Role: <@&${stream.roleId}>\n`
      if (stream.multiStream)
        message += `Multistream linked to: ${TWITCH_EMOTE.formatted}\`${stream.multiStream.stream.name}\``

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(message, env, { title: `${KICK_EMOTE.formatted} Kick streamer details` })] })
    }
    case 'help': {
      const helpCard = {
        type: 17,
        accent_color: 0xFFF200,
        components: [
          {
            type: 9,
            components: [
              {
                type: 10,
                content: `# ${KICK_EMOTE.formatted} Available commands`,
              },
              {
                type: 10,
                content: await getKickHelpMessage(env),
              },
            ],
            accessory: {
              type: 11,
              media: {
                url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
              },
            },
          },
        ],
      } satisfies APIMessageTopLevelComponent
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { components: [helpCard], flags: 1 << 15 })
    }
  }
  return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid command', env)] })
}

async function autoCompleteHandler(interaction: APIApplicationCommandAutocompleteInteraction, env: Env, _ctx: ExecutionContext) {
  if (!isGuildInteraction(interaction))
    return autoCompleteResponse([])
  const guildId = interaction.guild_id
  if (interaction.data.options.find(option => option.name === 'remove') || interaction.data.options.find(option => option.name === 'edit') || interaction.data.options.find(option => option.name === 'details') || interaction.data.options.find(option => option.name === 'test')) {
  // auto correct for streamer option from remove, edit, details and test
    const subCommand = interaction.data.options.find(option => option.name === 'remove') || interaction.data.options.find(option => option.name === 'edit') || interaction.data.options.find(option => option.name === 'details') || interaction.data.options.find(option => option.name === 'test')
    if (!subCommand || !('options' in subCommand) || !subCommand.options)
      return autoCompleteResponse([])
    const streamerOption = subCommand.options.find(option => option.name === 'streamer')
    if (!streamerOption || !('value' in streamerOption) || !('focused' in streamerOption))
      return autoCompleteResponse([])

    if (streamerOption.focused) {
      // we can auto complete the streamer field
      const input = streamerOption.value.toLowerCase()
      const cacheKey = `autocomplete:${guildId}:kick:${subCommand.name}:${input}`

      // Try KV cache
      const cached = await env.KV.get(cacheKey, { type: 'json' }) as { name: string, value: string }[] | null
      if (cached)
        return autoCompleteResponse(cached)

      const streamers = await useDB(env).query.kickStreams.findMany({
        where: (stream, { and, eq, like }) => and(eq(stream.guildId, guildId), like(stream.name, `%${streamerOption.value}%`)),
      })
      const choices = streamers
        .map(stream => ({ name: stream.name, value: stream.name }))
        .sort((a, b) => {
          if (a.name.toLowerCase() === input.toLowerCase() && b.name.toLowerCase() !== input.toLowerCase()) {
            return -1
          }
          if (b.name.toLowerCase() === input.toLowerCase() && a.name.toLowerCase() !== input.toLowerCase()) {
            return 1
          }
          return a.name.localeCompare(b.name)
        })
      await env.KV.put(cacheKey, JSON.stringify(choices), { expirationTtl: 60 })
      return autoCompleteResponse(choices)
    }
    return autoCompleteResponse([])
  }
  return autoCompleteResponse([])
}

export default {
  command: KICK_COMMAND,
  handler,
  autoCompleteHandler,
} satisfies DiscordAPIApplicationCommand
