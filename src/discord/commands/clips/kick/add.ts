import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, APIApplicationCommandInteractionDataSubcommandOption, InteractionType } from 'discord-api-types/v10'
import { tables, useDB } from '@database'
import { buildErrorEmbed, buildSuccessEmbed, calculateChannelPermissions, updateInteraction } from '@discord-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord-api-types/v10'
import { autoCompleteResponse } from '@/discord/interactionHandler'
import { getKickChannelV2, searchKickChannels } from '@/kick/kick'
import { KICK_EMOTE } from '@/utils/discordEmotes'

export const CLIPS_KICK_ADD_COMMAND = {
  type: 1,
  name: 'add',
  description: '(BETA) Subscribe to KICK clips from a streamer',
  dm_permission: false,
  options: [{
    type: 3,
    name: 'streamer',
    description: 'The name of the KICK streamer to subscribe to',
    required: true,
    autocomplete: true,
  }, {
    type: 7,
    name: 'discord-channel',
    description: 'The Discord channel where clips will be posted',
    required: true,
    channel_types: [0],
  }],
}

export async function handleClipsKickAddCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })
  if (command.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

  const add = command
  const server = interaction.guild_id
  const streamer = add.options?.find(option => option.name === 'streamer')?.value as string | undefined
  const channel = add.options?.find(option => option.name === 'discord-channel')?.value as string | undefined

  if (!streamer || !channel)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

  // check if we have permission to post in this discord channel
  const permissions = await calculateChannelPermissions(interaction.guild_id!, channel, env.DISCORD_APPLICATION_ID, env, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.MentionEveryone])
  const missingPermissions = Object.entries(permissions.checks)
    .filter(([_, hasPermission]) => !hasPermission)
    .map(([permissionName]) => permissionName)

  if (missingPermissions.length > 0) {
    const permissionError = `Dinkdonk Bot does not have the required permissions use <#${channel}>.\nMissing permissions: ${missingPermissions.join(', ')}`
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(permissionError, env)] })
  }

  // check if already subscribed to this kick channel
  const subscriptions = await useDB(env).query.kickClips.findMany({
    where: (clips, { eq, and, like }) => and(eq(clips.guildId, server), like(clips.streamer, streamer)),
  })
  if (subscriptions.length > 0)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`You are already subscribed to notifications for this streamer: \`${streamer}\``, env)] })

  const kickChannel = await getKickChannelV2(streamer, env)
  if (!kickChannel)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`Kick channel with name:\`${streamer}\` could not be found`, env)] })

  const subscription = await useDB(env).insert(tables.kickClips).values({
    streamer: kickChannel ? kickChannel.user.username : streamer,
    broadcasterId: kickChannel.user_id.toString(),
    guildId: server,
    channelId: channel,
  }).returning().get()

  if (!subscription)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Failed to add subscription', env)] })

  let details = `Streamer: \`${subscription.streamer}\`\n`
  details += `Channel: <#${subscription.channelId}>\n`

  return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(details, env, {
    title: `${KICK_EMOTE.formatted} Subscribed for Clip Notifications for \`${kickChannel ? kickChannel.user.username : streamer}\``,
    ...(kickChannel.user.profile_pic && {
      thumbnail: { url: kickChannel.user.profile_pic },
    }),
  })] })
}

export async function handleClipsKickAddAutoComplete(interaction: APIApplicationCommandAutocompleteInteraction, option: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommandAutocomplete>, env: Env) {
  if (option.type === ApplicationCommandOptionType.Subcommand) {
    const streamerOption = option.options?.find(option => option.name === 'streamer')
    if (!streamerOption || !('value' in streamerOption) || !('focused' in streamerOption))
      return autoCompleteResponse([])

    if (streamerOption.focused) {
      // we can auto complete the streamer field
      const input = streamerOption.value.toLowerCase()
      const cacheKey = `autocomplete:${interaction.guild_id}:kick:${option.name}:${input}`

      // Try KV cache
      const cached = await env.KV.get(cacheKey, { type: 'json' }) as { name: string, value: string }[] | null
      if (cached)
        return autoCompleteResponse(cached)

      const streamers = await searchKickChannels(input)

      const choices = streamers
        .map(stream => ({ name: stream.username, value: stream.slug }))
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
