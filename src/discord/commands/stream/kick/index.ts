import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, InteractionType } from 'discord-api-types/v10'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { buildErrorEmbed, updateInteraction } from '../../../discord'
import { autoCompleteResponse } from '../../../interactionHandler'
import { handleKickAddCommand, KICK_ADD_COMMAND } from './add'
import { handleKickDetailsCommand, KICK_DETAILS_COMMAND } from './details'
import { handleKickEditCommand, KICK_EDIT_COMMAND } from './edit'
import { handleKickDBAutoComplete, handleKickRemoveCommand, KICK_REMOVE_COMMAND } from './remove'
import { handleKickTestCommand, KICK_TEST_COMMAND } from './test'

export const KICK_SUBCOMMANDS = {
  type: 2,
  name: 'kick',
  description: 'Kick stream notifications',
  options: [
    KICK_ADD_COMMAND,
    KICK_REMOVE_COMMAND,
    KICK_DETAILS_COMMAND,
    KICK_EDIT_COMMAND,
    KICK_TEST_COMMAND,
  ],
}

export async function handleKickCommands(interaction: APIApplicationCommandInteraction, option: APIApplicationCommandInteractionDataOption, env: Env) {
  if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
    const subCommand = option.options[0]
    if (subCommand.type === ApplicationCommandOptionType.Subcommand) {
      switch (subCommand.name) {
        case 'add':{
          return handleKickAddCommand(interaction, subCommand, env)
        }
        case 'remove':{
          return handleKickRemoveCommand(interaction, subCommand, env)
        }
        case 'edit':{
          return handleKickEditCommand(interaction, subCommand, env)
        }
        case 'details':{
          return handleKickDetailsCommand(interaction, subCommand, env)
        }
        case 'test':{
          return handleKickTestCommand(interaction, subCommand, env)
        }
        default:
          return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Not implemented yet', env)] })
      }
    }
  }
  return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
}

export async function handleKickAutoComplete(interaction: APIApplicationCommandAutocompleteInteraction, option: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommandAutocomplete>, env: Env) {
  if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
    const subCommand = option.options[0]
    switch (subCommand.name) {
      case 'remove':
        return handleKickDBAutoComplete(interaction, subCommand, env)
      case 'edit':
        return handleKickDBAutoComplete(interaction, subCommand, env)
      case 'details':
        return handleKickDBAutoComplete(interaction, subCommand, env)
      case 'test':
        return handleKickDBAutoComplete(interaction, subCommand, env)
      default:
        return autoCompleteResponse([])
    }
  }
  return autoCompleteResponse([])
}
