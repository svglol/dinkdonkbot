import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, InteractionType } from 'discord-api-types/v10'
import { buildErrorEmbed, updateInteraction } from '@discord-api'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { CLIPS_KICK_EDIT_COMMAND, handleClipsKickDBAutoComplete, handleClipsKickEditCommand } from '@/discord/commands/clips/kick/edit'
import { CLIPS_KICK_LIST_COMMAND, handleClipsKickListCommand } from '@/discord/commands/clips/kick/list'
import { CLIPS_KICK_REMOVE_COMMAND, handleClipsKickRemoveCommand } from '@/discord/commands/clips/kick/remove'
import { autoCompleteResponse } from '@/discord/interactionHandler'
import { CLIPS_KICK_ADD_COMMAND, handleClipsKickAddAutoComplete, handleClipsKickAddCommand } from './add'

export const CLIPS_KICK_SUBCOMMANDS = {
  type: 2,
  name: 'kick',
  description: '(BETA) Kick clips notifications',
  options: [
    CLIPS_KICK_ADD_COMMAND,
    CLIPS_KICK_REMOVE_COMMAND,
    CLIPS_KICK_EDIT_COMMAND,
    CLIPS_KICK_LIST_COMMAND,
  ],
}

export async function handleClipsKickCommands(interaction: APIApplicationCommandInteraction, option: APIApplicationCommandInteractionDataOption, env: Env) {
  if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
    const subCommand = option.options[0]
    if (subCommand.type === ApplicationCommandOptionType.Subcommand) {
      switch (subCommand.name) {
        case 'add':{
          return handleClipsKickAddCommand(interaction, subCommand, env)
        }
        case 'remove':{
          return handleClipsKickRemoveCommand(interaction, subCommand, env)
        }
        case 'edit':{
          return handleClipsKickEditCommand(interaction, subCommand, env)
        }
        case 'list':{
          return handleClipsKickListCommand(interaction, subCommand, env)
        }
        default:
          return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Not implemented yet', env)] })
      }
    }
  }
  return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
}

export async function handleClipsKickAutoComplete(interaction: APIApplicationCommandAutocompleteInteraction, option: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommandAutocomplete>, env: Env) {
  if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
    const subCommand = option.options[0]
    switch (subCommand.name) {
      case 'add':
        return handleClipsKickAddAutoComplete(interaction, subCommand, env)
      case 'remove':
        return handleClipsKickDBAutoComplete(interaction, subCommand, env)
      case 'edit':
        return handleClipsKickDBAutoComplete(interaction, subCommand, env)
      default:
        return autoCompleteResponse([])
    }
  }
  return autoCompleteResponse([])
}
