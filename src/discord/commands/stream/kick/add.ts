import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption } from 'discord-api-types/v10'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord-api-types/v10'
import { tables, useDB } from '../../../../database/db'
import { getKickChannel, getKickChannelV2, getKickUser, kickSubscribe } from '../../../../kick/kick'
import { KICK_EMOTE, TWITCH_EMOTE } from '../../../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, calculateChannelPermissions, updateInteraction } from '../../../discord'

export const KICK_ADD_COMMAND = {
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
}

export async function handleKickAddCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })
  const server = interaction.guild_id
  const add = command
  if (add.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  const streamer = add.options?.find(option => option.name === 'streamer')?.value as string | undefined
  const channel = add.options?.find(option => option.name === 'discord-channel')?.value as string | undefined
  const role = add.options?.find(option => option.name === 'ping-role')?.value as string | undefined
  const liveMessage = add.options?.find(option => option.name === 'live-message')?.value as string | undefined
  const offlineMessage = add.options?.find(option => option.name === 'offline-message')?.value as string | undefined
  const cleanup = add.options?.find(option => option.name === 'cleanup')?.value as boolean | undefined || false

  // make sure we have all arguments we need
  if (!server || !streamer || !channel)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Missing required arguments', env)] })

  // make nessary checks all at once to increase performance
  const [subscriptions, kickChannel, permissions] = await Promise.all([
    await useDB(env).query.kickStreams.findMany({
      where: (kickStreams, { eq, and, like }) => and(eq(kickStreams.guildId, server), like(kickStreams.name, streamer)),
    }),
    await getKickChannel(streamer, env),
    await calculateChannelPermissions(interaction.guild_id!, channel!, env.DISCORD_APPLICATION_ID, env.DISCORD_TOKEN, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.MentionEveryone]),
  ])

  // check if already subscribed to this channel
  if (subscriptions.length > 0)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`You're already subscribed to notifications for \`${streamer}\` on this server`, env)] })

  // check if kick channel exists
  if (!kickChannel)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`Kick channel with name:\`${streamer}\` could not be found`, env)] })

  const kickUser = await getKickUser(Number(kickChannel.broadcaster_user_id), env)

  // check if we have permission to post in this discord channel
  const missingPermissions = Object.entries(permissions.checks)
    .filter(([_, hasPermission]) => !hasPermission)
    .map(([permissionName]) => permissionName)

  if (missingPermissions.length > 0) {
    const permissionError = `Dinkdonk Bot does not have the required permissions use <#${channel}>.\nMissing permissions: ${missingPermissions.join(', ')}`
    console.error(permissionError)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(permissionError, env)] })
  }

  // subscribe to event sub for this channel
  const subscribed = await kickSubscribe(kickChannel.broadcaster_user_id, env)
  if (!subscribed)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Something went wrong while trying to subscribe to kick events', env)] })

  let roleId: string | undefined
  if (role) {
    roleId = role
    if (roleId === server)
      roleId = undefined
  }

  const liveText = liveMessage
  const offlineText = offlineMessage

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
