import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, APIApplicationCommandInteractionDataSubcommandOption, InteractionType } from 'discord-api-types/v10'
import { buildErrorEmbed, buildSuccessEmbed, calculateChannelPermissions, calculateGuildPermissions, findBotCommandMarkdown, removeRole, setRole, updateInteraction } from '@discord-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord-api-types/v10'
import { birthdayOverviewUpdate, getTimezoneFromQuery, validateTimezone } from '@/birthdays'
import { eq, tables, useDB } from '@/database/db'
import { birthdayConfig } from '@/database/schema'
import { autoCompleteResponse } from '@/discord/interactionHandler'

export const BIRTHDAYS_CONFIG_SETUP_COMMAND = {
  type: 1,
  name: 'setup',
  description: 'Setup the birthday config for this server',
  default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
  dm_permission: false,
  options: [
    { type: 7, name: 'announcement-channel', description: 'Announcement channel', required: true, channel_types: [0] },
    { type: 7, name: 'overview-channel', description: 'Overview channel', required: true, channel_types: [0] },
    { type: 8, name: 'role', description: 'Birthday role' },
    { type: 3, name: 'timezone', description: 'IANA timezone (e.g. Pacific/Auckland)', autocomplete: true },
  ],
}

export async function handleBirthdaysConfigSetupCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  if (command.type !== ApplicationCommandOptionType.Subcommand)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  if (!isGuildInteraction(interaction))
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in guilds', env)] })

  const announcementChannelId = command.options?.find(option => option.name === 'announcement-channel')?.value as string | undefined
  const overviewChannelId = command.options?.find(option => option.name === 'overview-channel')?.value as string | undefined
  const roleId = command.options?.find(option => option.name === 'role')?.value as string | undefined
  const timezone = command.options?.find(option => option.name === 'timezone')?.value as string | undefined
  const server = interaction.guild_id

  // if a config already exists tell them to use the edit command instead
  const existingConfig = await useDB(env).query.birthdayConfig.findFirst({
    where: (config, { eq }) => eq(config.guildId, server!),
  })
  if (existingConfig) {
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`A birthday config already exists for this server, if you wish to edit it use ${await findBotCommandMarkdown(env, 'birthdays', 'config', 'edit')}`, env)] })
  }

  if (!announcementChannelId || !overviewChannelId) {
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Announcement channel and Overview channel are required', env)] })
  }

  if (timezone && !validateTimezone(timezone))
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Timezone is not valid it should be a valid IANA timezone (e.g. Pacific/Auckland)', env)] })

  // validate the role and permissions needed for it
  if (roleId) {
    const permissions = await calculateGuildPermissions(server, env, [PermissionFlagsBits.ManageRoles])
    if ((permissions.permissions & PermissionFlagsBits.ManageRoles) !== PermissionFlagsBits.ManageRoles) {
      return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This bot does not have permission to manage roles in this server, add the permission and try again', env)] })
    }

    const userId = interaction.member?.user.id || interaction.user?.id
    if (!userId)
      return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Unable to get user ID from interaction', env)] })

    // check the bot can actually set the role by checking the role hierarchy
    const addRole = await setRole(server, userId, roleId, env)
    if (!addRole) {
      return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Failed to set the birthday role, make sure the bot role is above the birthday role', env)] })
    }
    else {
    // remove the role
      await removeRole(server, userId, roleId, env)
    }
  }
  // validate permissions for the announcement channel
  const announcementPermissions = await calculateChannelPermissions(interaction.guild_id!, announcementChannelId!, env.DISCORD_APPLICATION_ID, env, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel])
  const missingAnnouncementPermissions = Object.entries(announcementPermissions.checks).filter(([_, hasPermission]) => !hasPermission).map(([permissionName]) => permissionName)
  if (missingAnnouncementPermissions.length > 0) {
    const permissionError = `Dinkdonk Bot does not have the required permissions to use <#${announcementChannelId}>.\nMissing permissions: ${missingAnnouncementPermissions.join(', ')}`
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(permissionError, env)] })
  }

  // validate permissions for the overview channel
  const overviewPermissions = await calculateChannelPermissions(interaction.guild_id!, overviewChannelId!, env.DISCORD_APPLICATION_ID, env, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel])
  const missingOverviewPermissions = Object.entries(overviewPermissions.checks).filter(([_, hasPermission]) => !hasPermission).map(([permissionName]) => permissionName)
  if (missingOverviewPermissions.length > 0) {
    const permissionError = `Dinkdonk Bot does not have the required permissions to use <#${overviewChannelId}>.\nMissing permissions: ${missingOverviewPermissions.join(', ')}`
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(permissionError, env)] })
  }

  await useDB(env).insert(tables.birthdayConfig).values({ guildId: server, announcementChannelId, overviewChannelId, birthdayRoleId: roleId, timezone }).onConflictDoUpdate({
    target: birthdayConfig.guildId,
    set: { announcementChannelId, overviewChannelId, birthdayRoleId: roleId, timezone },
  })

  // update the overview message
  const overviewMessageId = await birthdayOverviewUpdate(server!, env)
  await useDB(env).update(tables.birthdayConfig).set({ overviewMessageId }).where(eq(tables.birthdayConfig.guildId, server!))

  await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed('Successfully setup birthday configuration', env)], components: [] })
}

export async function handleBirthdaysConfigSetupAutoComplete(interaction: APIApplicationCommandAutocompleteInteraction, option: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommandAutocomplete>, env: Env) {
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
