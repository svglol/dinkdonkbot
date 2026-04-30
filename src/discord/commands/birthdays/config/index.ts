import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption } from 'discord-api-types/v10'
import { buildErrorEmbed, updateInteraction } from '@discord-api'
import { isChatInputApplicationCommandInteraction, isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord-api-types/v10'
import { BIRTHDAYS_CONFIG_DETAILS_COMMAND, handleBirthdaysConfigDetailsCommand } from '@/discord/commands/birthdays/config/details'
import { BIRTHDAYS_CONFIG_EDIT_COMMAND, handleBirthdaysConfigEditAutoComplete, handleBirthdaysConfigEditCommand } from '@/discord/commands/birthdays/config/edit'
import { BIRTHDAYS_CONFIG_SETUP_COMMAND, handleBirthdaysConfigSetupAutoComplete, handleBirthdaysConfigSetupCommand } from '@/discord/commands/birthdays/config/setup'
import { BIRTHDAYS_CONFIG_TEST_COMMAND, handleBirthdaysConfigTestCommand } from '@/discord/commands/birthdays/config/test'
import { autoCompleteResponse, interactionEphemeralLoading } from '@/discord/interactionHandler'

export const BIRTHDAYS_CONFIG_COMMAND = {
  type: 1,
  name: 'birthdays-config',
  description: 'Admin: configure birthday notifications',
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  options: [
    BIRTHDAYS_CONFIG_DETAILS_COMMAND,
    BIRTHDAYS_CONFIG_SETUP_COMMAND,
    BIRTHDAYS_CONFIG_EDIT_COMMAND,
    BIRTHDAYS_CONFIG_TEST_COMMAND,
  ],
}

async function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleBirthdaysConfig(interaction, env))
  return interactionEphemeralLoading()
}

async function handleBirthdaysConfig(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  const option = interaction.data.options?.[0]
  if (!option)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  switch (option.name) {
    case 'details':
      return handleBirthdaysConfigDetailsCommand(interaction, option, env)
    case 'setup':
      return handleBirthdaysConfigSetupCommand(interaction, option, env)
    case 'edit':
      return handleBirthdaysConfigEditCommand(interaction, option, env)
    case 'test':
      return handleBirthdaysConfigTestCommand(interaction, option, env)
    default:
      return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Not implemented yet', env)] })
  }
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

async function autoCompleteHandler(interaction: APIApplicationCommandAutocompleteInteraction, env: Env, _ctx: ExecutionContext) {
  if (!isGuildInteraction(interaction))
    return autoCompleteResponse([])

  const option = interaction.data.options[0]
  switch (option.name) {
    case 'setup':
      return handleBirthdaysConfigSetupAutoComplete(interaction, option, env)
    case 'edit':
      return handleBirthdaysConfigEditAutoComplete(interaction, option, env)
    default:
      return autoCompleteResponse([])
  }
}

export default {
  command: BIRTHDAYS_CONFIG_COMMAND,
  handler,
  autoCompleteHandler,
  messageComponentHandlers: { },
} satisfies DiscordAPIApplicationCommand
