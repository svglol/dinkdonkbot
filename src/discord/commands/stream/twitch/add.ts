import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, APIApplicationCommandInteractionDataSubcommandOption, InteractionType } from 'discord-api-types/v10'
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord-api-types/v10'
import { tables, useDB } from '../../../../database/db'
import { getChannelId, getStreamerDetails, searchStreamers, subscribe } from '../../../../twitch/twitch'
import { KICK_EMOTE, TWITCH_EMOTE } from '../../../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, calculateChannelPermissions, updateInteraction } from '../../../discord'
import { autoCompleteResponse } from '../../../interactionHandler'

export const TWITCH_ADD_COMMAND = {
  type: 1,
  name: 'add',
  description: 'Add a Twitch streamer to receive alerts for going live',
  options: [
    { type: 3, name: 'streamer', description: 'Streamer name', required: true, autocomplete: true },
    { type: 7, name: 'discord-channel', description: 'Discord channel', required: true, channel_types: [0] },
    { type: 8, name: 'ping-role', description: 'Role to ping' },
    { type: 3, name: 'live-message', description: 'Live message' },
    { type: 3, name: 'offline-message', description: 'Offline message' },
    { type: 5, name: 'cleanup', description: 'Remove notification after offline' },
  ],
}

export async function handleTwitchAddCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  const server = interaction.guild_id
  if (!command)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
  if (command.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

  const streamer = command.options?.find(option => option.name === 'streamer')?.value as string | undefined
  const channel = command.options?.find(option => option.name === 'discord-channel')?.value as string | undefined
  const role = command.options?.find(option => option.name === 'ping-role')?.value as string | undefined
  const liveMessage = command.options?.find(option => option.name === 'live-message')?.value as string | undefined
  const offlineMessage = command.options?.find(option => option.name === 'offline-message')?.value as string | undefined
  const cleanup = command.options?.find(option => option.name === 'cleanup')?.value as boolean | undefined

  // make sure we have all arguments we need
  if (!server || !streamer || !channel)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

  // make nessary checks all at once to increase performance
  const [subscriptions, channelId, permissions] = await Promise.all([
    await useDB(env).query.streams.findMany({
      where: (streams, { eq, and, like }) => and(eq(streams.guildId, server), like(streams.name, streamer)),
    }),
    await getChannelId(streamer, env),
    await calculateChannelPermissions(interaction.guild_id!, channel!, env.DISCORD_APPLICATION_ID, env.DISCORD_TOKEN, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.MentionEveryone]),
  ])

  // check if already subscribed to this channel
  if (subscriptions.length > 0)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`You're already subscribed to notifications for \`${streamer}\` on this server`, env)] })

  // check if twitch channel exists
  if (!channelId)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`Twitch channel with name:\`${streamer}\` could not be found`, env)] })

  // check if we have permission to post in this discord channel
  const missingPermissions = Object.entries(permissions.checks).filter(([_, hasPermission]) => !hasPermission).map(([permissionName]) => permissionName)
  if (missingPermissions.length > 0) {
    const permissionError = `Dinkdonk Bot does not have the required permissions use <#${channel}>.\nMissing permissions: ${missingPermissions.join(', ')}`
    console.error(permissionError)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(permissionError, env)] })
  }

  // subscribe to event sub for this channel
  const subscribed = await subscribe(channelId, env)
  if (!subscribed)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Dinkdonk Bot failed to subscribe to Twitch event sub', env)] })

  let roleId: string | undefined
  if (role) {
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
    details += `\nAutomatically make a multi-stream with Kick Stream: ${KICK_EMOTE.formatted}\`${kickStream.name}\`\n`

  return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(`${details}`, env, {
    title: `${TWITCH_EMOTE.formatted} Subscribed to notifications for \`${subscription.name}\``,
    ...(streamerDetails?.profile_image_url && {
      thumbnail: { url: streamerDetails.profile_image_url },
    }),
  })] })
}

export async function handleTwitchAddAutoComplete(interaction: APIApplicationCommandAutocompleteInteraction, option: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommandAutocomplete>, env: Env) {
  if (option.type === ApplicationCommandOptionType.Subcommand) {
    const streamerOption = option.options?.find(option => option.name === 'streamer')
    if (!streamerOption || !('value' in streamerOption) || !('focused' in streamerOption))
      return autoCompleteResponse([])

    if (streamerOption.focused) {
      // we can auto complete the streamer field
      const input = streamerOption.value.toLowerCase()
      const cacheKey = `autocomplete:${interaction.guild_id}:twitch:${option.name}:${input}`

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
