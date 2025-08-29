import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, InteractionType } from 'discord-api-types/v10'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { buildErrorEmbed, updateInteraction } from '../../../discord'
import { autoCompleteResponse } from '../../../interactionHandler'
import { CLIPS_TWITCH_ADD_COMMAND, handleClipsTwitchAddCommand } from './add'
import { CLIPS_TWITCH_EDIT_COMMAND, handleClipsTwitchDBAutoComplete, handleClipsTwitchEditCommand } from './edit'
import { CLIPS_TWITCH_HELP_COMMAND, handleClipsTwitchHelpCommand } from './help'
import { CLIPS_TWITCH_LIST_COMMAND, handleClipsTwitchListCommand } from './list'
import { CLIPS_TWITCH_REMOVE_COMMAND, handleClipsTwitchRemoveCommand } from './remove'

export const CLIPS_TWITCH_SUBCOMMANDS = {
  type: 2,
  name: 'twitch',
  description: 'Twitch clips alerts',
  options: [
    CLIPS_TWITCH_ADD_COMMAND,
    CLIPS_TWITCH_REMOVE_COMMAND,
    CLIPS_TWITCH_EDIT_COMMAND,
    CLIPS_TWITCH_LIST_COMMAND,
    CLIPS_TWITCH_HELP_COMMAND,
  ],
}

export async function handleClipsTwitchCommands(interaction: APIApplicationCommandInteraction, option: APIApplicationCommandInteractionDataOption, env: Env) {
  if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
    const subCommand = option.options[0]
    if (subCommand.type === ApplicationCommandOptionType.Subcommand) {
      switch (subCommand.name) {
        case 'add':{
          return handleClipsTwitchAddCommand(interaction, subCommand, env)
        }
        case 'remove':{
          return handleClipsTwitchRemoveCommand(interaction, subCommand, env)
        }
        case 'edit':{
          return handleClipsTwitchEditCommand(interaction, subCommand, env)
        }
        case 'list':{
          return handleClipsTwitchListCommand(interaction, subCommand, env)
        }
        case 'help':{
          return handleClipsTwitchHelpCommand(interaction, subCommand, env)
        }
        default:
          return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Not implemented yet', env)] })
      }
    }
  }
  return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
}

export async function handleClipsTwitchAutoComplete(interaction: APIApplicationCommandAutocompleteInteraction, option: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommandAutocomplete>, env: Env) {
  if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
    const subCommand = option.options[0]
    switch (subCommand.name) {
      case 'add':
        return handleClipsTwitchAutoComplete(interaction, option, env)
      case 'remove':
        return handleClipsTwitchDBAutoComplete(interaction, subCommand, env)
      case 'edit':
        return handleClipsTwitchDBAutoComplete(interaction, subCommand, env)
      default:
        return autoCompleteResponse([])
    }
  }
  return autoCompleteResponse([])
}
