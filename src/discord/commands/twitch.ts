import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import type { StreamMessage } from '../../database/db'
import { isChatInputApplicationCommandInteraction, isGuildInteraction } from 'discord-api-types/utils'
import { PermissionFlagsBits } from 'discord-api-types/v10'
import { and, eq, like } from 'drizzle-orm'
import { tables, useDB } from '../../database/db'
import { getKickChannelV2, getKickLatestVod, getKickLivestream } from '../../kick/kick'
import { getChannelId, getLatestVOD, getStreamDetails, getStreamerDetails, removeSubscription, searchStreamers, subscribe } from '../../twitch/twitch'
import { KICK_EMOTE, TWITCH_EMOTE } from '../../util/discordEmotes'
import { bodyBuilder, buildErrorEmbed, buildSuccessEmbed, checkChannelPermission, sendMessage, updateInteraction } from '../discord'
import { autoCompleteResponse, interactionEphemeralLoading } from '../interactionHandler'

const TWITCH_COMMAND = {
  name: 'twitch',
  description: 'Twitch stream notifications',
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  dm_permission: false,
  options: [{
    type: 1,
    name: 'add',
    description: 'Add a Twitch streamer to receive notifications for going online',
    dm_permission: false,
    options: [{
      type: 3,
      name: 'streamer',
      description: 'The name of the streamer to add',
      required: true,
      autocomplete: true,
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
  }, {
    type: 1,
    name: 'remove',
    description: 'Remove a Twitch streamer from receiving notifications for going online or offline',
    dm_permission: false,
    options: [{
      type: 3,
      name: 'streamer',
      description: 'The name of the streamer to remove',
      required: true,
      autocomplete: true,
    }],
  }, {
    type: 1,
    name: 'edit',
    description: 'Edit a Twitch streamer\'s settings',
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
  }, {
    type: 1,
    name: 'list',
    description: 'List the twitch streamers that you are subscribed to',
    dm_permission: false,
  }, {
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
  }, {
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
  }, {
    type: 1,
    name: 'help',
    description: 'Show help for the twitch command and its subcommands',
    dm_permission: false,
  }],
}

export const TWITCH_HELP_MESSAGE = `- </twitch add:1227872472049782919> <streamer> <discord-channel> <ping-role> <live-message> <offline-message> <cleanup> - Add a Twitch streamer to receive notifications for going online or offline
- </twitch edit:1227872472049782919> <streamer> <discord-channel> <ping-role> <live-message> <offline-message> <cleanup> - Edit a Twitch streamer’s settings  
- </twitch remove:1227872472049782919> <streamer> - Remove a Twitch streamer from receiving notifications for going online or offline  
- </twitch list:1227872472049782919> - List the Twitch streamers that you are subscribed to  
- </twitch test:1227872472049782919> <streamer> <global> - Test the notification for a streamer  
\`<global>\` – Whether to send the message to everyone or not  
- </twitch details:1227872472049782919> <streamer> - Show the details for a streamer you are subscribed to  
- </twitch help:1227872472049782919> - Get this help message  
**Command variables**
\`\`\`
<streamer> – The name of the streamer to add  
<discord-channel> – The Discord channel to post to when the streamer goes live  
<ping-role> – What role to @ when the streamer goes live  
<live-message> – The message to post when the streamer goes live  
<offline-message> – The message to post when the streamer goes offline  
<cleanup> – Delete notifications once the streamer goes offline  
\`\`\`
**Message variables**  
\`\`\`
{{name}}       = the name of the streamer
{{url}}        = the url for the stream
{{everyone}}   = @everyone
{{here}}       = @here
{{game}}/{{category}} = the game or category of the stream (live only)
{{timestamp}}  = the time the stream started/ended
\`\`\`
`

function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleTwitchCommand(interaction, env))
  return interactionEphemeralLoading()
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
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  if (!interaction.data.options)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })

  const option = interaction.data.options[0].name
  switch (option) {
    case 'add': {
      const server = interaction.guild_id
      const add = interaction.data.options.find(option => option.name === 'add')
      if (!add || !('options' in add) || !add.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

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
      const cleanupOption = add.options.find(option => option.name === 'cleanup')
      const cleanup = cleanupOption && 'value' in cleanupOption ? cleanupOption.value as boolean : undefined
      // make sure we have all arguments
      if (!server || !streamer || !channel)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

      // check if already subscribed to this channel
      const subscriptions = await useDB(env).query.streams.findMany({
        where: (streams, { eq, and, like }) => and(eq(streams.guildId, server), like(streams.name, streamer)),
      })
      if (subscriptions.length > 0)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`You're already subscribed to notifications for \`${streamer}\` on this server`, env)] })

      // check if twitch channel exists
      const channelId = await getChannelId(streamer, env)
      if (!channelId)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`Twitch channel with name:\`${streamer}\` could not be found`, env)] })

      // check if we have permission to post in this discord channel
      const hasPermission = await checkChannelPermission(channel, env.DISCORD_TOKEN)
      if (!hasPermission)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`Dinkdonk Bot does not have the required permissions to post in <#${channel}>`, env)] })

      // subscribe to event sub for this channel
      const subscribed = await subscribe(channelId, env)
      if (!subscribed)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Dinkdonk Bot failed to subscribe to Twitch event sub', env)] })

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
      const subscription = await useDB(env).insert(tables.streams).values({
        name: streamerDetails ? streamerDetails.display_name : streamer,
        broadcasterId: channelId,
        guildId: server,
        channelId: channel,
        roleId,
        liveMessage: liveText,
        offlineMessage: offlineText,
        cleanup,
      }).returning().get()

      if (!subscription)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Failed to add subscription to database', env)] })

      // create a multi stream if a matching kick stream is found
      const kickStream = await useDB(env).query.kickStreams.findFirst({
        where: (kickStreams, { eq, and, like }) => and(eq(kickStreams.channelId, channel), like(kickStreams.name, streamer)),
        with: {
          multiStream: true,
        },
      })
      if (kickStream && !kickStream.multiStream) {
        await useDB(env).insert(tables.multiStream).values({
          streamId: subscription.id,
          kickStreamId: kickStream.id,
        })
      }

      let details = `Streamer: \`${subscription.name}\`\n`
      details += `Channel: <#${subscription.channelId}>\n`
      details += `Live Message: \`${subscription.liveMessage}\`\n`
      details += `Offline Message: \`${subscription.offlineMessage}\`\n`
      details += `Cleanup: \`${subscription.cleanup}\`\n`
      if (subscription.roleId)
        details += `Role: <@&${subscription.roleId}>\n`
      if (kickStream && !kickStream.multiStream)
        details += `\nAutomatically make a multi-stream with Kick Stream: \`${kickStream.name}\`\n`

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(`${details}`, env, {
        title: `${TWITCH_EMOTE.formatted} Subscribed to notifications for \`${subscription.name}\``,
        ...(streamerDetails?.profile_image_url && {
          thumbnail: { url: streamerDetails.profile_image_url },
        }),
      })] })
    }
    case 'remove': {
      const remove = interaction.data.options.find(option => option.name === 'remove')
      if (!remove || !('options' in remove) || !remove.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
      const streamerOption = remove.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
      const stream = await useDB(env).query.streams.findFirst({
        where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
      })
      if (!stream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })

      await useDB(env).delete(tables.streams).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))
      const subscriptions = await useDB(env).query.streams.findMany({
        where: (streams, { like }) => like(streams.name, streamer),
      })
      if (subscriptions.length === 0 && stream)
        await removeSubscription(stream.broadcasterId, env)

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(`Unsubscribed from notifications for **${streamer}**`, env)] })
    }
    case 'edit':{
      const server = interaction.guild_id
      const edit = interaction.data.options.find(option => option.name === 'edit')
      if (!edit || !('options' in edit) || !edit.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
      const streamerOption = edit.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
      const dbStream = await useDB(env).query.streams.findFirst({
        where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
      })
      if (!dbStream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })

      const channel = edit.options.find(option => option.name === 'discord-channel')
      if (channel) {
        const hasPermission = await checkChannelPermission(String('value' in channel ? channel.value as string : ''), env.DISCORD_TOKEN)
        if (hasPermission) {
          await useDB(env).update(tables.streams).set({ channelId: String('value' in channel ? channel.value : '') }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))
        }
        else {
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This bot does not have permission to send messages in this channel', env)] })
        }
      }
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

      const cleanup = edit.options.find(option => option.name === 'cleanup')
      if (cleanup)
        await useDB(env).update(tables.streams).set({ cleanup: 'value' in cleanup ? Boolean(cleanup.value) : false }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))

      // get up to date sub
      const subscription = await useDB(env).query.streams.findFirst({
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

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(`${details}`, env, { title: `${TWITCH_EMOTE.formatted} Edited notifications for \`${streamer}\`` })] })
    }
    case 'list': {
      const streams = await useDB(env).query.streams.findMany({
        where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id),
      })
      let streamList = 'Not subscribed to any streams'
      if (streams.length > 0) {
        streamList = streams.map(stream => `**${stream.name}** - <#${stream.channelId}>`).join('\n')
      }
      else {
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Not subscribed to any Twitch streams', env)] })
      }

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(streamList, env, { title: `${TWITCH_EMOTE.formatted} Twitch Streams` })] })
    }
    case 'test':{
      const test = interaction.data.options.find(option => option.name === 'test')
      if (!test || !('options' in test) || !test.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
      const streamer = test.options.find(option => option.name === 'streamer')
      const global = test.options.find(option => option.name === 'global')
      const stream = await useDB(env).query.streams.findFirst({
        where: (streams, { and, eq, like }) => and(like(streams.name, streamer && 'value' in streamer ? streamer.value as string : ''), eq(streams.guildId, interaction.guild_id)),
        with: {
          multiStream: {
            with: {
              kickStream: true,
            },
          },
        },
      })
      if (!stream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer && 'value' in streamer ? streamer.value as string : ''}\``, env)] })

      const messageTypeOption = test.options.find(option => option.name === 'message-type')
      const messageType = messageTypeOption && 'value' in messageTypeOption ? messageTypeOption.value as string : 'live'

      const multiStreamOption = test.options.find(option => option.name === 'multistream')
      const multiStream = multiStreamOption && 'value' in multiStreamOption ? Boolean(multiStreamOption.value) && stream.multiStream : false

      const [streamerData, streamData] = await Promise.all([
        getStreamerDetails(stream.name, env),
        getStreamDetails(stream.name, env),
      ])

      let kickStreamData: KickLiveStream | null = null
      let kickStreamerData: KickChannelV2 | null = null
      if (multiStream) {
        [kickStreamerData, kickStreamData] = await Promise.all([
          await getKickChannelV2(stream.multiStream.kickStream.name) ?? null,
          await getKickLivestream(Number(stream.multiStream.kickStream.broadcasterId), env) ?? null,
        ])
      }

      const kickVod = multiStream ? messageType === 'live' ? null : await getKickLatestVod(kickStreamData?.started_at || new Date().toISOString(), stream.name) : null
      const twitchVod = messageType === 'live' ? null : await getLatestVOD(stream.broadcasterId, streamData?.id || '', env)

      // build a fake stream message object
      const streamMessage = {
        id: 0,
        streamId: stream.id,
        stream,
        kickStream: multiStream ? stream.multiStream.kickStream : null,
        kickStreamId: multiStream ? stream.multiStream.kickStreamId : null,
        kickStreamStartedAt: multiStream ? messageType === 'live' ? new Date(kickStreamData?.started_at || new Date()) : new Date(new Date(kickStreamData?.started_at || new Date()).getTime() - 3600000) : messageType === 'live' ? new Date() : null,
        kickStreamEndedAt: multiStream ? messageType === 'live' ? null : new Date() : null,
        twitchStreamStartedAt: messageType === 'live' ? new Date(streamData?.started_at || new Date()) : new Date(new Date(streamData?.started_at || new Date()).getTime() - 3600000),
        twitchStreamEndedAt: messageType === 'live' ? null : new Date(),
        discordChannelId: stream.channelId,
        discordMessageId: null,
        twitchStreamId: streamData?.id || null,
        twitchOnline: messageType === 'live',
        twitchStreamData: streamData,
        twitchStreamerData: streamerData,
        twitchVod: twitchVod ?? null,
        kickStreamData,
        kickStreamerData,
        kickVod,
        kickOnline: multiStream ? messageType === 'live' : false,
        createdAt: new Date().toISOString(),
      } satisfies StreamMessage

      const body = bodyBuilder(streamMessage, env)
      if (global) {
        if ('value' in global && global.value === true) {
          await sendMessage(stream.channelId, env.DISCORD_TOKEN, body, env)
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed('Sent test message', env)] })
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
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
      const streamerOption = details.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
      const stream = await useDB(env).query.streams.findFirst({
        where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
        with: { multiStream: { with: { kickStream: true } } },
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
        message += `Multistream linked to: ${KICK_EMOTE.formatted}:\`${stream.multiStream.kickStream.name}\``

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(message, env, { title: `${TWITCH_EMOTE.formatted} Twitch Stream Notification Details` })] })
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
                content: `# ${TWITCH_EMOTE.formatted} Available commands`,
              },
              {
                type: 10,
                content: TWITCH_HELP_MESSAGE,
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
      const cacheKey = `autocomplete:${guildId}:clips:${subCommand.name}:${input}`

      // Try KV cache
      const cached = await env.KV.get(cacheKey, { type: 'json' }) as { name: string, value: string }[] | null
      if (cached)
        return autoCompleteResponse(cached)

      const streamers = await useDB(env).query.streams.findMany({
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
  }
  if (interaction.data.options.find(option => option.name === 'add')) {
    // auto complete for add sub command (this one searches for streamers on twitch)
    const subCommand = interaction.data.options.find(option => option.name === 'add')
    if (!subCommand || !('options' in subCommand) || !subCommand.options)
      return autoCompleteResponse([])
    const streamerOption = subCommand.options.find(option => option.name === 'streamer')
    if (!streamerOption || !('value' in streamerOption) || !('focused' in streamerOption))
      return autoCompleteResponse([])

    if (streamerOption.focused) {
      // we can auto complete the streamer field
      const input = streamerOption.value.toLowerCase()
      const cacheKey = `autocomplete:${guildId}:twitch:${subCommand.name}:${input}`

      // Try KV cache
      const cached = await env.KV.get(cacheKey, { type: 'json' }) as { name: string, value: string }[] | null
      if (cached)
        return autoCompleteResponse(cached)

      const streamers = await searchStreamers(input, env)

      const choices = streamers
        .map(stream => ({ name: stream.display_name, value: stream.display_name }))
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
  }
  return autoCompleteResponse([])
}

export default {
  command: TWITCH_COMMAND,
  handler,
  autoCompleteHandler,
} satisfies DiscordAPIApplicationCommand
