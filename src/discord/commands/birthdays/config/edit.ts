import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, APIApplicationCommandInteractionDataSubcommandOption, APIEmbed, InteractionType } from 'discord-api-types/v10'
import { buildErrorEmbed, buildSuccessEmbed, calculateChannelPermissions, calculateGuildPermissions, findBotCommandMarkdown, removeRole, setRole, updateInteraction } from '@discord-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord-api-types/v10'
import { birthdayOverviewUpdate, getTimezoneFromQuery, validateTimezone } from '@/birthdays'
import { tables, useDB } from '@/database/db'
import { birthdayConfig } from '@/database/schema'
import { autoCompleteResponse } from '@/discord/interactionHandler'

export const BIRTHDAYS_CONFIG_EDIT_COMMAND = {
  type: 1,
  name: 'edit',
  description: 'Edit the birthday config for this server',
  default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
  dm_permission: false,
  options: [
    { type: 7, name: 'announcement-channel', description: 'Announcement channel', channel_types: [0] },
    { type: 7, name: 'overview-channel', description: 'Overview channel', channel_types: [0] },
    { type: 8, name: 'role', description: 'Birthday role' },
    { type: 3, name: 'timezone', description: 'IANA timezone (e.g. Pacific/Auckland)', autocomplete: true },
    { type: 5, name: 'enable', description: 'Enable birthdays' },
  ],
}

export async function handleBirthdaysConfigEditCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  if (command.type !== ApplicationCommandOptionType.Subcommand)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  if (!isGuildInteraction(interaction))
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in guilds', env)] })

  if (!interaction.member?.permissions || !(BigInt(interaction.member.permissions) & PermissionFlagsBits.ManageGuild))
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('You do not have permission to use this command', env)] })

  const userId = interaction.member?.user.id || interaction.user?.id
  if (!userId)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Unable to get user ID from interaction', env)] })

  const server = interaction.guild_id
  const announcementChannelId = command.options?.find(option => option.name === 'announcement-channel')?.value as string | undefined
  const overviewChannelId = command.options?.find(option => option.name === 'overview-channel')?.value as string | undefined
  const roleId = command.options?.find(option => option.name === 'role')?.value as string | undefined
  const timezone = command.options?.find(option => option.name === 'timezone')?.value as string | undefined
  const enable = command.options?.find(option => option.name === 'enable')?.value as boolean | undefined

  const existingConfig = await useDB(env).query.birthdayConfig.findFirst({
    where: (config, { eq }) => eq(config.guildId, server!),
  })
  if (!existingConfig) {
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`A birthday config does not exist for this server, use ${await findBotCommandMarkdown(env, 'birthdays', 'config', 'setup')} to setup one`, env)] })
  }

  if (!announcementChannelId && !overviewChannelId && !roleId && !timezone && enable === undefined) {
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('At least one option must be provided', env)] })
  }

  let updateMessage = ''
  let errors = 0
  const toUpdate = [announcementChannelId, overviewChannelId, roleId, timezone, enable].filter(v => v != null || v !== undefined).length

  // update announcement channel
  if (announcementChannelId) {
    const announcementPermissions = await calculateChannelPermissions(interaction.guild_id!, announcementChannelId!, env.DISCORD_APPLICATION_ID, env, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel])
    const missingAnnouncementPermissions = Object.entries(announcementPermissions.checks).filter(([_, hasPermission]) => !hasPermission).map(([permissionName]) => permissionName)
    if (missingAnnouncementPermissions.length > 0) {
      updateMessage += `Missing permissions in announcement channel: ${missingAnnouncementPermissions.join(', ')}\n`
      errors++
    }
    else {
      await useDB(env).insert(tables.birthdayConfig).values({ guildId: server, announcementChannelId }).onConflictDoUpdate({
        target: birthdayConfig.guildId,
        set: { announcementChannelId },
      })

      updateMessage += `Announcement channel has been set successfully to <#${announcementChannelId}>\n`
    }
  }

  // update overview channel
  if (overviewChannelId) {
    const overviewPermissions = await calculateChannelPermissions(interaction.guild_id!, overviewChannelId!, env.DISCORD_APPLICATION_ID, env, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel])
    const missingOverviewPermissions = Object.entries(overviewPermissions.checks).filter(([_, hasPermission]) => !hasPermission).map(([permissionName]) => permissionName)
    if (missingOverviewPermissions.length > 0) {
      updateMessage += `Missing permissions in overview channel: ${missingOverviewPermissions.join(', ')}\n`
      errors++
    }
    else {
      await useDB(env).insert(tables.birthdayConfig).values({ guildId: server, overviewChannelId }).onConflictDoUpdate({
        target: birthdayConfig.guildId,
        set: { overviewChannelId },
      })
    }
  }

  // update birthday role
  if (roleId) {
    const permissions = await calculateGuildPermissions(server, env, [PermissionFlagsBits.ManageRoles])
    if ((permissions.permissions & PermissionFlagsBits.ManageRoles) !== PermissionFlagsBits.ManageRoles) {
      updateMessage += `Failed to set the birthday role, the bot doesnt have the permission to manage roles\n`
      errors++
    }
    else {
    // check the bot can actually set the role by checking the role hierarchy
      const addRole = await setRole(server, userId, roleId, env)
      if (!addRole) {
        updateMessage += `Failed to set the birthday role, make sure the DinkDonk Botrole is above the birthday role you are trying to set\n`
        errors++
      }
      else {
        await removeRole(server, userId, roleId, env)
        await useDB(env).insert(tables.birthdayConfig).values({ guildId: server, birthdayRoleId: roleId }).onConflictDoUpdate({
          target: birthdayConfig.guildId,
          set: { birthdayRoleId: roleId },
        })
        updateMessage += `Birthday role has been set successfully to <@&${roleId}>\n`
        await birthdayOverviewUpdate(server!, env)
      }
    }
  }

  // update timezone
  if (timezone) {
    if (!validateTimezone(timezone)) {
      updateMessage += `Timezone is not valid it should be a valid IANA timezone (e.g. Pacific/Auckland)\n`
      errors++
    }
    else {
      await useDB(env).insert(tables.birthdayConfig).values({ guildId: server, timezone }).onConflictDoUpdate({
        target: birthdayConfig.guildId,
        set: { timezone },
      })
      updateMessage += `Timezone has been set successfully to ${timezone}\n`
    }
  }

  if (enable !== undefined) {
    await useDB(env).insert(tables.birthdayConfig).values({ guildId: server, disabled: !enable }).onConflictDoUpdate({
      target: birthdayConfig.guildId,
      set: { disabled: !enable },
    })
    await birthdayOverviewUpdate(server!, env)
    updateMessage += `Birthdays have been ${enable ? 'enabled' : 'disabled'} successfully\n`
  }

  let embed: APIEmbed = {}
  if (errors === 0) {
    embed = buildSuccessEmbed(`**Updated birthdays config:**\n${updateMessage}`, env)
  }
  else if (errors === toUpdate) {
    embed = buildErrorEmbed(`**Failed to update birthdays config:**\n${updateMessage}`, env)
  }
  else {
    embed = buildErrorEmbed(`**Partially updated birthdays config:**\n${updateMessage}`, env, { color: 0xFFF200 })
  }
  return updateInteraction(interaction, env, { embeds: [embed] })
}

export async function handleBirthdaysConfigEditAutoComplete(interaction: APIApplicationCommandAutocompleteInteraction, option: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommandAutocomplete>, env: Env) {
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
