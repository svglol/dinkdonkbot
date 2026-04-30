import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { buildErrorEmbed, updateInteraction } from '@discord-api'
import { isChatInputApplicationCommandInteraction, isGuildInteraction } from 'discord-api-types/utils'

import { BIRTHDAYS_SHOW_COMMAND, handleBirthdaysShowCommand } from '@/discord/commands/birthdays/show'
import { autoCompleteResponse, interactionEphemeralLoading, interactionLoading } from '@/discord/interactionHandler'
import { BIRTHDAYS_HELP_COMMAND, handleBirthdaysHelpCommand } from './help'
import { BIRTHDAYS_LIST_COMMAND, handleBirthdaysListCommand, handleBirthdaysListMessageComponent } from './list'
import { BIRTHDAYS_REGISTER_COMMAND, handleBirthdaysRegisterCommand, handleBirthdaysRegisterCommandAutoComplete } from './register'
import { BIRTHDAYS_REMOVE_COMMAND, handleBirthdaysRemoveCommand } from './remove'
import { BIRTHDAYS_UPCOMING_COMMAND, handleBirthdaysUpcomingCommand } from './upcoming'

export const BIRTHDAYS_COMMAND = {
  name: 'birthdays',
  description: 'Birthday notifications',
  type: 1,
  dm_permission: false,
  options: [
    BIRTHDAYS_REGISTER_COMMAND,
    BIRTHDAYS_REMOVE_COMMAND,
    BIRTHDAYS_UPCOMING_COMMAND,
    BIRTHDAYS_LIST_COMMAND,
    BIRTHDAYS_HELP_COMMAND,
    BIRTHDAYS_SHOW_COMMAND,
  ],
}

async function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleBirthdays(interaction, env))
  // need this check to get the options
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return interactionEphemeralLoading()
  const option = interaction.data.options?.[0]
  switch (option?.name) {
    case 'register':
      return interactionLoading()
    case 'upcoming':
      return interactionLoading()

    default:
      return interactionEphemeralLoading()
  }
}

async function handleBirthdays(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  const option = interaction.data.options?.[0]
  if (!option)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  switch (option.name) {
    case 'register':
      return await handleBirthdaysRegisterCommand(interaction, option, env)
    case 'remove':
      return await handleBirthdaysRemoveCommand(interaction, option, env)
    case 'upcoming':
      return await handleBirthdaysUpcomingCommand(interaction, option, env)
    case 'list':
      return await handleBirthdaysListCommand(interaction, option, env)
    case 'help':
      return await handleBirthdaysHelpCommand(interaction, option, env)
    case 'show':
      return await handleBirthdaysShowCommand(interaction, option, env)
    default:
      return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`${option.name} command is not implemented yet`, env)] })
  }
}

async function autoCompleteHandler(interaction: APIApplicationCommandAutocompleteInteraction, env: Env, _ctx: ExecutionContext) {
  if (!isGuildInteraction(interaction))
    return autoCompleteResponse([])

  const option = interaction.data.options[0]
  switch (option.name) {
    case 'register':
      return handleBirthdaysRegisterCommandAutoComplete(interaction, option, env)
    default:
      return autoCompleteResponse([])
  }
}
export default {
  command: BIRTHDAYS_COMMAND,
  handler,
  autoCompleteHandler,
  messageComponentHandlers: { birthday_month_select: handleBirthdaysListMessageComponent, birthday_prev_page: handleBirthdaysListMessageComponent, birthday_next_page: handleBirthdaysListMessageComponent },
} satisfies DiscordAPIApplicationCommand
