import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, InteractionType } from 'discord-api-types/v10'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { buildErrorEmbed, updateInteraction } from '../../../discord'
import { autoCompleteResponse } from '../../../interactionHandler'
import { handleMultistreamDetailsCommand, MULTISTREAM_DETAILS_COMMAND } from './details'
import { handleMultistreamEditCommand, MULTISTREAM_EDIT_COMMAND } from './edit'
import { handleMultistreamLinkAutoComplete, handleMultistreamLinkCommand, MULTISTREAM_LINK_COMMAND } from './link'
import { handleMultistreamUnlinkAutoComplete, handleMultistreamUnlinkCommand, MULTISTREAM_UNLINK_COMMAND } from './unlink'

export const MULTISTREAM_SUBCOMMANDS = {
  type: 2,
  name: 'multistream',
  description: 'Merge Twitch/Kick notifications into one message',
  options: [
    MULTISTREAM_LINK_COMMAND,
    MULTISTREAM_UNLINK_COMMAND,
    MULTISTREAM_EDIT_COMMAND,
    MULTISTREAM_DETAILS_COMMAND,
  ],
}

export async function handleMultistreamCommands(interaction: APIApplicationCommandInteraction, option: APIApplicationCommandInteractionDataOption, env: Env) {
  if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
    const subCommand = option.options[0]
    if (subCommand.type === ApplicationCommandOptionType.Subcommand) {
      switch (subCommand.name) {
        case 'link':
          return handleMultistreamLinkCommand(interaction, subCommand, env)
        case 'unlink':
          return handleMultistreamUnlinkCommand(interaction, subCommand, env)
        case 'edit':
          return handleMultistreamEditCommand(interaction, subCommand, env)
        case 'details':
          return handleMultistreamDetailsCommand(interaction, subCommand, env)
        default:
          return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Not implemented yet', env)] })
      }
    }
  }
  return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
}

export async function handleMultistreamAutoComplete(interaction: APIApplicationCommandAutocompleteInteraction, option: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommandAutocomplete>, env: Env) {
  if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
    const subCommand = option.options[0]
    switch (subCommand.name) {
      case 'link':
        return handleMultistreamLinkAutoComplete(interaction, subCommand, env)
      case 'unlink':
        return handleMultistreamUnlinkAutoComplete(interaction, subCommand, env)
      case 'edit':
        return handleMultistreamUnlinkAutoComplete(interaction, subCommand, env)
      case 'details':
        return handleMultistreamUnlinkAutoComplete(interaction, subCommand, env)
      default:
        return autoCompleteResponse([])
    }
  }
  return autoCompleteResponse([])
}
