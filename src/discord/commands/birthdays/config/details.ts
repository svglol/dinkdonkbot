import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption } from 'discord-api-types/v10'
import { buildErrorEmbed, fetchGuild, updateInteraction } from '@discord-api'
import { isGuildInteraction } from 'discord-api-types/utils/v10'
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord-api-types/v10'
import { useDB } from '@/database/db'

export const BIRTHDAYS_CONFIG_DETAILS_COMMAND = {
  type: 1,
  name: 'details',
  description: 'Show the current birthday configuration for this server',
  default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
  dm_permission: false,
}

export async function handleBirthdaysConfigDetailsCommand(interaction: APIApplicationCommandInteraction, option: APIApplicationCommandInteractionDataOption, env: Env) {
  if (option.type !== ApplicationCommandOptionType.Subcommand)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })

  if (!interaction.member?.permissions || !(BigInt(interaction.member.permissions) & PermissionFlagsBits.ManageGuild))
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('You do not have permission to use this command', env)] })

  const server = interaction.guild_id

  const birthdayConfig = await useDB(env).query.birthdayConfig.findFirst({
    where: (config, { eq }) => eq(config.guildId, server!),
  })

  if (!birthdayConfig)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This server does not have a birthday config setup yet', env)] })

  const guild = await fetchGuild(server, env)

  const timezone = birthdayConfig.timezone
  const announcementChannelId = birthdayConfig.announcementChannelId
  const overviewChannelId = birthdayConfig.overviewChannelId
  const birthdayRoleId = birthdayConfig.birthdayRoleId
  const enabled = !birthdayConfig.disabled

  const embed = {
    title: `🎂 Birthdays Config - ${guild?.name || 'Unknown Server'}`,
    color: 0xFFF200,
    description: [
      `Announcement Channel: ${announcementChannelId ? `<#${announcementChannelId}>` : '`Not set`'}`,
      `Overview Channel: ${overviewChannelId ? `<#${overviewChannelId}>` : '`Not set`'}`,
      `Timezone: ${timezone || '`Not set`'}`,
      `Birthday Role: ${birthdayRoleId ? `<@&${birthdayRoleId}>` : '`Not set`'}`,
      `Birthday Notifications: ${enabled ? '`enabled`' : '`disabled`'}`,
    ].join('\n'),
    thumbnail: {
      url: guild?.icon ? `https://cdn.discordapp.com/icons/${server}/${guild.icon}.png` : env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
    },
    footer: {
      text: 'DinkDonk Bot',
      icon_url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
    },
    timestamp: new Date().toISOString(),
  }

  return updateInteraction(interaction, env, { embeds: [embed] })
}
