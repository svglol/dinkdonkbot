import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, InteractionType } from 'discord-api-types/v10'
import { buildErrorEmbed, updateInteraction } from '@discord-api'
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord-api-types/v10'
import { BIRTHDAYS_CONFIG_DETAILS_COMMAND, handleBirthdaysConfigDetailsCommand } from '@/discord/commands/birthdays/config/details'
import { BIRTHDAYS_CONFIG_EDIT_COMMAND, handleBirthdaysConfigEditAutoComplete, handleBirthdaysConfigEditCommand } from '@/discord/commands/birthdays/config/edit'
import { BIRTHDAYS_CONFIG_SETUP_COMMAND, handleBirthdaysConfigSetupAutoComplete, handleBirthdaysConfigSetupCommand } from '@/discord/commands/birthdays/config/setup'
import { BIRTHDAYS_CONFIG_TEST_COMMAND, handleBirthdaysConfigTestCommand } from '@/discord/commands/birthdays/config/test'
import { autoCompleteResponse } from '@/discord/interactionHandler'

export const BIRTHDAYS_CONFIG_SUBCOMMANDS = {
  type: 2,
  name: 'config',
  description: 'Admin: configure birthday notifications',
  default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
  options: [
    BIRTHDAYS_CONFIG_DETAILS_COMMAND,
    BIRTHDAYS_CONFIG_SETUP_COMMAND,
    BIRTHDAYS_CONFIG_EDIT_COMMAND,
    BIRTHDAYS_CONFIG_TEST_COMMAND,
  ],
}
export async function handleBirthdaysConfigCommands(interaction: APIApplicationCommandInteraction, option: APIApplicationCommandInteractionDataOption, env: Env) {
  if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
    const subCommand = option.options[0]
    if (subCommand.type === ApplicationCommandOptionType.Subcommand) {
      switch (subCommand.name) {
        case 'details':
          return handleBirthdaysConfigDetailsCommand(interaction, subCommand, env)
        case 'setup':
          return handleBirthdaysConfigSetupCommand(interaction, subCommand, env)
        case 'edit':
          return handleBirthdaysConfigEditCommand(interaction, subCommand, env)
        case 'test':
          return handleBirthdaysConfigTestCommand(interaction, subCommand, env)
        default:
          return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Not implemented yet', env)] })
      }
    }
  }

  return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
}

export async function handleBirthdaysConfigAutoComplete(interaction: APIApplicationCommandAutocompleteInteraction, option: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommandAutocomplete>, env: Env) {
  if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
    const subCommand = option.options[0]
    if (subCommand.type === ApplicationCommandOptionType.Subcommand) {
      switch (subCommand.name) {
        case 'setup':
          return handleBirthdaysConfigSetupAutoComplete(interaction, subCommand, env)
        case 'edit':
          return handleBirthdaysConfigEditAutoComplete(interaction, subCommand, env)
        default:
          return autoCompleteResponse([])
      }
    }
  }
  return autoCompleteResponse([])
}
