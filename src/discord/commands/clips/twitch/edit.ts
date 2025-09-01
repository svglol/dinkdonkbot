import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, APIApplicationCommandInteractionDataSubcommandOption, InteractionType } from 'discord-api-types/v10'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord-api-types/v10'
import { and, eq, like } from 'drizzle-orm'
import { tables, useDB } from '../../../../database/db'
import { buildErrorEmbed, buildSuccessEmbed, calculateChannelPermissions, updateInteraction } from '../../../discord'
import { autoCompleteResponse } from '../../../interactionHandler'

export const CLIPS_TWITCH_EDIT_COMMAND = {
  type: 1,
  name: 'edit',
  description: 'Update the settings for a Twitch clip subscription',
  dm_permission: false,
  options: [{
    type: 3,
    name: 'streamer',
    description: 'The name of the Twitch streamer to update',
    required: true,
    autocomplete: true,
  }, {
    type: 7,
    name: 'discord-channel',
    description: 'The Discord channel where clips will be posted',
    channel_types: [0],
    required: true,
  }],
}

export async function handleClipsTwitchEditCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })
  if (command.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

  const edit = command
  const server = interaction.guild_id
  if (!edit || !('options' in edit) || !edit.options)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
  const streamer = edit.options?.find(option => option.name === 'streamer')?.value as string | undefined
  if (!streamer)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
  const dbClip = await useDB(env).query.clips.findFirst({
    where: (clips, { and, eq, like }) => and(like(clips.streamer, streamer), eq(clips.guildId, interaction.guild_id)),
  })
  if (!dbClip)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('You are not subscribed to this streamer', env)] })

  const channel = edit.options.find(option => option.name === 'discord-channel')
  if (channel) {
    const channelValue = String('value' in channel ? channel.value : '')
    const permissions = await calculateChannelPermissions(interaction.guild_id!, channelValue, env.DISCORD_APPLICATION_ID, env, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel])
    const missingPermissions = Object.entries(permissions.checks)
      .filter(([_, hasPermission]) => !hasPermission)
      .map(([permissionName]) => permissionName)

    if (missingPermissions.length > 0) {
      const permissionError = `Dinkdonk Bot does not have the required permissions use <#${channelValue}>.\nMissing permissions: ${missingPermissions.join(', ')}`
      console.error(permissionError)
      return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(permissionError, env)] })
    }

    await useDB(env).update(tables.clips).set({ channelId: channelValue }).where(and(like(tables.clips.streamer, streamer), eq(tables.clips.guildId, server)))
  }

  return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(`Edited \`${streamer}\` for clip notifications`, env)] })
}

export async function handleClipsTwitchDBAutoComplete(interaction: APIApplicationCommandAutocompleteInteraction, option: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommandAutocomplete>, env: Env) {
  if (option.type === ApplicationCommandOptionType.Subcommand) {
    if (!isGuildInteraction(interaction))
      return autoCompleteResponse([])
    const streamerOption = option.options?.find(option => option.name === 'streamer')
    if (!streamerOption || !('value' in streamerOption) || !('focused' in streamerOption))
      return autoCompleteResponse([])

    if (streamerOption.focused) {
    // we can auto complete the streamer field
      const input = streamerOption.value.toLowerCase()
      const cacheKey = `autocomplete:${interaction.guild_id}:clips:${option.name}:${input}`

      // Try KV cache
      const cached = await env.KV.get(cacheKey, { type: 'json' }) as { name: string, value: string }[] | null
      if (cached)
        return autoCompleteResponse(cached)

      const streamers = await useDB(env).query.clips.findMany({
        where: (clips, { and, eq, like }) => and(eq(clips.guildId, interaction.guild_id), like(clips.streamer, `%${streamerOption.value}%`)),
      })
      const choices = streamers
        .map(stream => ({ name: stream.streamer, value: stream.streamer }))
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
