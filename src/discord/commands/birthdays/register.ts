import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, APIEmbed, InteractionType } from 'discord-api-types/v10'
import { buildErrorEmbed, buildSuccessEmbed, fetchUser, findBotCommandMarkdown, updateInteraction } from '@discord-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord-api-types/v10'
import { birthdayOverviewUpdate, getTimezoneFromQuery, validateTimezone } from '@/birthdays'
import { eq, tables, useDB } from '@/database/db'
import { autoCompleteResponse } from '@/discord/interactionHandler'
import { monthNames, ordinal } from '@/utils/dates'

export const BIRTHDAYS_REGISTER_COMMAND = {
  type: 1,
  name: 'register',
  description: 'Register or update your birthday',
  dm_permission: false,
  options: [
    { type: 4, name: 'day', description: 'Day of the month', required: true, min_value: 1, max_value: 31 },
    { type: 3, name: 'month', description: 'Month', required: true, choices: [
      { name: 'January', value: '1' },
      { name: 'February', value: '2' },
      { name: 'March', value: '3' },
      { name: 'April', value: '4' },
      { name: 'May', value: '5' },
      { name: 'June', value: '6' },
      { name: 'July', value: '7' },
      { name: 'August', value: '8' },
      { name: 'September', value: '9' },
      { name: 'October', value: '10' },
      { name: 'November', value: '11' },
      { name: 'December', value: '12' },
    ] },
    { type: 4, name: 'year', description: 'Year (optional)' },
    { type: 3, name: 'timezone', description: 'Timezone (optional) - IANA timezone or search for your location', autocomplete: true },
    { type: 6, name: 'user', description: '(ADMIN ONLY) User to register the birthday for' },
  ],
}

export async function handleBirthdaysRegisterCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataOption, env: Env) {
  const serverId = interaction.guild_id
  let userId = interaction.member?.user.id || interaction.user?.id
  if (command.type !== ApplicationCommandOptionType.Subcommand)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  if (!isGuildInteraction(interaction))
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })

  const day = command.options?.find(option => option.name === 'day')?.value as number | undefined
  const monthOption = command.options?.find(option => option.name === 'month')?.value as string | undefined
  const month = monthOption ? Number.parseInt(monthOption) : undefined
  const year = command.options?.find(option => option.name === 'year')?.value as number | undefined
  const timezone = command.options?.find(option => option.name === 'timezone')?.value as string | undefined
  const userOption = command.options?.find(option => option.name === 'user')?.value as string | undefined

  // verify that the day and month combo is valid
  if (day && month) {
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    if (day > daysInMonth[month - 1]) {
      return updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`Invalid date: ${day}/${month} does not exist`, env)] })
    }
  }

  if (userOption && userOption !== userId) {
    // check if the user has admin permissions
    const member = interaction.member
    const permissions = BigInt(member?.permissions ?? '0')
    const isAdmin = (permissions & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator
    if (!isAdmin) {
      return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('You do not have permission to register a birthday for another user', env)] })
    }
    // if they do then set the userId to the user option value
    userId = userOption
  }

  if (!day || !month)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Day and month are required', env)] })

  const birthdayConfig = await useDB(env).query.birthdayConfig.findFirst({
    where: eq(tables.birthdayConfig.guildId, serverId!),
  })

  //

  if (!birthdayConfig || birthdayConfig.announcementChannelId === null || birthdayConfig.overviewChannelId === null)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This server does not have a birthday config setup. A server admin needs to set the birthday config first!', env)] })

  if (birthdayConfig.disabled)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`Birthday notifications are currently disabled in this server. A server admin can enable them using ${await findBotCommandMarkdown(env, 'birthdays', 'config', 'edit')}`, env)] })

  if (timezone && !validateTimezone(timezone))
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Timezone is not valid it should be a valid IANA timezone (e.g. Pacific/Auckland)', env)] })

  // update or insert the birthday for this user and server
  await useDB(env)
    .insert(tables.birthday)
    .values({ guildId: serverId!, userId: userId!, day, month, year, timezone, disabled: false })
    .onConflictDoUpdate({
      target: [tables.birthday.guildId, tables.birthday.userId],
      set: { day, month, year, timezone, disabled: false },
    })

  await birthdayOverviewUpdate(serverId!, env)
  const user = await fetchUser(userId!, env)

  const description = `<@${userId!}>'s birthday has been registered on ${ordinal(day)} ${monthNames[month - 1]}${year ? ` ${year}` : ''}${timezone ? ` with timezone ${timezone}` : ''}`
  const embed = {
    title: '🎂 Birthday Registered',
    description,
    thumbnail: user?.avatar
      ? {
          url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
        }
      : undefined,
  } satisfies APIEmbed

  return updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(``, env, embed)] })
}

export async function handleBirthdaysRegisterCommandAutoComplete(interaction: APIApplicationCommandAutocompleteInteraction, option: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommandAutocomplete>, env: Env) {
  if (option.type === ApplicationCommandOptionType.Subcommand) {
    const timezoneOption = option.options?.find(option => option.name === 'timezone')
    if (!timezoneOption || !('value' in timezoneOption) || !('focused' in timezoneOption)) {
      return autoCompleteResponse([])
    }

    if (timezoneOption.focused) {
      return autoCompleteResponse(await getTimezoneFromQuery(timezoneOption.value, env))
    }
  }
  return autoCompleteResponse([])
}
