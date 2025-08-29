import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { isChatInputApplicationCommandInteraction, isGuildInteraction } from 'discord-api-types/utils'
import { PermissionFlagsBits } from 'discord-api-types/v10'

import { buildErrorEmbed, updateInteraction } from '../../discord'
import { autoCompleteResponse, interactionEphemeralLoading } from '../../interactionHandler'
import { handleStreamHelpCommand, handleStreamHelpMessageComponent, STREAM_HELP_COMMAND } from './help'
import { handleKickAutoComplete, handleKickCommands, KICK_SUBCOMMANDS } from './kick'
import { handleStreamListCommand, handleStreamListMessageComponent, STREAM_LIST_COMMAND } from './list'
import { handleMultistreamAutoComplete, handleMultistreamCommands, MULTISTREAM_SUBCOMMANDS } from './multistream'
import { handleTwitchAutoComplete, handleTwitchCommands, TWITCH_SUBCOMMANDS } from './twitch'

// // TODO move test commands to its own file and not part of kick/twitch subcommand groups

export const STREAM_COMMAND = {
  name: 'stream',
  description: 'Stream notifications settings',
  type: 1,
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  dm_permission: false,
  options: [TWITCH_SUBCOMMANDS, KICK_SUBCOMMANDS, MULTISTREAM_SUBCOMMANDS, STREAM_HELP_COMMAND, STREAM_LIST_COMMAND],
}

async function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleStream(interaction, env))
  return interactionEphemeralLoading()
}

async function handleStream(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  const option = interaction.data.options?.[0]
  if (!option)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  switch (option.name) {
    case 'twitch':
      return await handleTwitchCommands(interaction, option, env)
    case 'kick':
      return await handleKickCommands(interaction, option, env)
    case 'multistream':
      return await handleMultistreamCommands(interaction, option, env)
    case 'list':
      return await handleStreamListCommand(interaction, env)
    case 'help':
      return await handleStreamHelpCommand(interaction, env)
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
      return handleTwitchAutoComplete(interaction, option, env)
    case 'kick':
      return handleKickAutoComplete(interaction, option, env)
    case 'multistream':
      return handleMultistreamAutoComplete(interaction, option, env)
    default:
      return autoCompleteResponse([])
  }
}
export default {
  command: STREAM_COMMAND,
  handler,
  autoCompleteHandler,
  messageComponentHandlers: { stream_help_page_select: handleStreamHelpMessageComponent, stream_type_select: handleStreamListMessageComponent, stream_prev_page: handleStreamListMessageComponent, stream_next_page: handleStreamListMessageComponent },
} satisfies DiscordAPIApplicationCommand
