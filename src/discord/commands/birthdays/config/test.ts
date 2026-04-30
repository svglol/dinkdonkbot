import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption } from 'discord-api-types/v10'
import { buildErrorEmbed, buildSuccessEmbed, findBotCommandMarkdown, sendMessage, updateInteraction } from '@discord-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord-api-types/v10'
import { buildAnnouncementMessage } from '@/birthdays'
import { useDB } from '@/database/db'

export const BIRTHDAYS_CONFIG_TEST_COMMAND = {
  type: 1,
  name: 'test',
  description: 'Send a test birthday announcement',
  default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
  dm_permission: false,
}

export async function handleBirthdaysConfigTestCommand(interaction: APIApplicationCommandInteraction, option: APIApplicationCommandInteractionDataOption, env: Env) {
  if (option.type !== ApplicationCommandOptionType.Subcommand)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  if (!isGuildInteraction(interaction))
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a guild', env)] })

  if (!interaction.member?.permissions || !(BigInt(interaction.member.permissions) & PermissionFlagsBits.ManageGuild))
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('You do not have permission to use this command', env)] })

  const server = interaction.guild_id

  const birthdaysConfig = await useDB(env).query.birthdayConfig.findFirst({
    where: (config, { eq }) => eq(config.guildId, server!),
  })
  if (!birthdaysConfig)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`This server does not have a birthday config setup yet, use ${await findBotCommandMarkdown(env, 'birthdays-config', 'setup')} to setup one`, env)] })

  if (birthdaysConfig.disabled)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`This server has birthdays disabled, use ${await findBotCommandMarkdown(env, 'birthdays-config', 'edit')} to enable them`, env)] })

  if (!birthdaysConfig.announcementChannelId)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This server does not have an announcement channel setup yet', env)] })

  // test message
  const testMessage = await buildAnnouncementMessage([{
    userId: env.DISCORD_APPLICATION_ID,
    year: new Date().getFullYear() - 100,
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
    guildId: interaction.guild_id,
    disabled: false,
    id: 0,
    timezone: null,
    announcedAt: null,
  }], env)

  await sendMessage(birthdaysConfig.announcementChannelId, testMessage, env)

  return updateInteraction(interaction, env, { embeds: [buildSuccessEmbed('Test birthday announcement sent!', env)] })
}
