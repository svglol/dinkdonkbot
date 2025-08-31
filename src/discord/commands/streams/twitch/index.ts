import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, InteractionType } from 'discord-api-types/v10'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { buildErrorEmbed, updateInteraction } from '../../../discord'
import { autoCompleteResponse } from '../../../interactionHandler'
import { handleTwitchAddAutoComplete, handleTwitchAddCommand, TWITCH_ADD_COMMAND } from './add'
import { handleTwitchDetailsCommand, TWITCH_DETAILS_COMMAND } from './details'
import { handleTwitchEditCommand, TWITCH_EDIT_COMMAND } from './edit'
import { handleTwitchDBAutoComplete, handleTwitchRemoveCommand, TWITCH_REMOVE_COMMAND } from './remove'
import { handleTwitchTestCommand, TWITCH_TEST_COMMAND } from './test'

export const TWITCH_SUBCOMMANDS = {
  type: 2,
  name: 'twitch',
  description: 'Twitch stream notifications',
  options: [
    TWITCH_ADD_COMMAND,
    TWITCH_EDIT_COMMAND,
    TWITCH_REMOVE_COMMAND,
    TWITCH_DETAILS_COMMAND,
    TWITCH_TEST_COMMAND,
  ],
}

export async function handleTwitchCommands(interaction: APIApplicationCommandInteraction, option: APIApplicationCommandInteractionDataOption, env: Env) {
  if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
    const subCommand = option.options[0]
    if (subCommand.type === ApplicationCommandOptionType.Subcommand) {
      switch (subCommand.name) {
        case 'add':{
          return handleTwitchAddCommand(interaction, subCommand, env)
        }
        case 'remove':{
          return handleTwitchRemoveCommand(interaction, subCommand, env)
        }
        case 'edit':{
          return handleTwitchEditCommand(interaction, subCommand, env)
        }
        case 'details':{
          return handleTwitchDetailsCommand(interaction, subCommand, env)
        }
        case 'test':{
          return handleTwitchTestCommand(interaction, subCommand, env)
        }
        default:
          return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Not implemented yet', env)] })
      }
    }
  }
  return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
}

export async function handleTwitchAutoComplete(interaction: APIApplicationCommandAutocompleteInteraction, option: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommandAutocomplete>, env: Env) {
  if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
    const subCommand = option.options[0]
    switch (subCommand.name) {
      case 'add':
        return handleTwitchAddAutoComplete(interaction, subCommand, env)
      case 'remove':
        return handleTwitchDBAutoComplete(interaction, subCommand, env)
      case 'edit':
        return handleTwitchDBAutoComplete(interaction, subCommand, env)
      case 'details':
        return handleTwitchDBAutoComplete(interaction, subCommand, env)
      case 'test':
        return handleTwitchDBAutoComplete(interaction, subCommand, env)
      default:
        return autoCompleteResponse([])
    }
  }
  return autoCompleteResponse([])
}
