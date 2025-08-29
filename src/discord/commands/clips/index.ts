import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { isChatInputApplicationCommandInteraction, isGuildInteraction } from 'discord-api-types/utils'
import { PermissionFlagsBits } from 'discord-api-types/v10'
import { buildErrorEmbed, updateInteraction } from '../../discord'
import { autoCompleteResponse, interactionEphemeralLoading } from '../../interactionHandler'
import { CLIPS_TWITCH_SUBCOMMANDS, handleClipsTwitchAutoComplete, handleClipsTwitchCommands } from './twitch'

export const CLIPS_COMMAND = {
  name: 'clips',
  description: 'Clips notifications settings',
  type: 1,
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  dm_permission: false,
  options: [CLIPS_TWITCH_SUBCOMMANDS],
}

async function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleClips(interaction, env))
  return interactionEphemeralLoading()
}

async function handleClips(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  const option = interaction.data.options?.[0]
  if (!option)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  switch (option.name) {
    case 'twitch':
      return await handleClipsTwitchCommands(interaction, option, env)
    default:
      return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`${option.name} command is not implemented yet`, env)] })
  }
}

async function autoCompleteHandler(interaction: APIApplicationCommandAutocompleteInteraction, env: Env, _ctx: ExecutionContext) {
  if (!isGuildInteraction(interaction))
    return autoCompleteResponse([])
  const option = interaction.data.options[0]
  switch (option.name) {
    case 'twitch':
      return handleClipsTwitchAutoComplete(interaction, option, env)
    default:
      return autoCompleteResponse([])
  }
}

export default {
  command: CLIPS_COMMAND,
  handler,
  autoCompleteHandler,
} satisfies DiscordAPIApplicationCommand
