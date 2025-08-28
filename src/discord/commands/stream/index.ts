import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { isChatInputApplicationCommandInteraction, isGuildInteraction } from 'discord-api-types/utils'
import { PermissionFlagsBits } from 'discord-api-types/v10'

import { buildErrorEmbed, updateInteraction } from '../../discord'
import { autoCompleteResponse, interactionEphemeralLoading } from '../../interactionHandler'
import { handleKickAutoComplete, handleKickCommands, KICK_SUBCOMMANDS } from './kick'
import { handleMultistreamAutoComplete, handleMultistreamCommands, MULTISTREAM_SUBCOMMANDS } from './multistream'
import { handleTwitchAutoComplete, handleTwitchCommands, TWITCH_SUBCOMMANDS } from './twitch'

// // TODO  combined list command
// // TODO list command might need buttons for pagination
// const LIST_COMMAND = {
//   type: 1,
//   name: 'list',
//   description: 'List your subscribed streamers',
//   dm_permission: false,
// }

// // combined help command
// // TODO help command might need select for pagination
// // TODO message variables should be its own page
// const HELP_COMMAND = {
//   type: 1,
//   name: 'help',
//   description: 'Show help for the stream command',
//   dm_permission: false,
// }

// // TODO move test commands to its own file and not part of kick/twitch subcommand groups

export const STREAM_COMMAND = {
  name: 'stream',
  description: 'Stream notifications settings',
  type: 1,
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  dm_permission: false,
  options: [TWITCH_SUBCOMMANDS, KICK_SUBCOMMANDS, MULTISTREAM_SUBCOMMANDS],
}

async function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleStream(interaction, env))
  return interactionEphemeralLoading()
}

async function handleStream(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  const option = interaction.data.options?.[0]
  if (!option)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  switch (option.name) {
    case 'twitch':
      return await handleTwitchCommands(interaction, option, env)
    case 'kick':
      return await handleKickCommands(interaction, option, env)
    case 'multistream':
      return await handleMultistreamCommands(interaction, option, env)
    default:
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`${option.name} command is not implemented yet`, env)] })
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
} satisfies DiscordAPIApplicationCommand
