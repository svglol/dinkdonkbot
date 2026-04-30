import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, APIEmbed } from 'discord-api-types/v10'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '@discord-api'
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord-api-types/v10'
import { birthdayOverviewUpdate } from '@/birthdays'
import { and, eq, tables, useDB } from '@/database/db'

export const BIRTHDAYS_REMOVE_COMMAND = {
  type: 1,
  name: 'remove',
  description: 'Remove your registered birthday',
  dm_permission: false,
  options: [
    { type: 6, name: 'user', description: '(ADMIN ONLY) User to remove the birthday for' },
  ],
}

export async function handleBirthdaysRemoveCommand(interaction: APIApplicationCommandInteraction, option: APIApplicationCommandInteractionDataOption, env: Env) {
  if (option.type !== ApplicationCommandOptionType.Subcommand)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  const serverId = interaction.guild_id
  let userId = interaction.member?.user.id || interaction.user?.id
  const userOption = option.options?.find(option => option.name === 'user')?.value as string | undefined

  let isRemovingOther = false
  if (userOption && userOption !== userId) {
    const member = interaction.member
    const permissions = BigInt(member?.permissions ?? '0')
    const isAdmin = (permissions & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator
    if (!isAdmin) {
      return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('You do not have permission to remove a birthday for another user', env)] })
    }
    userId = userOption
    isRemovingOther = true
  }

  await useDB(env).delete(tables.birthday).where(and(eq(tables.birthday.guildId, serverId!), eq(tables.birthday.userId, userId!)))
  await birthdayOverviewUpdate(serverId!, env)

  const embed = {
    title: 'Birthday removed!',
    description: isRemovingOther ? `<@${userId}>'s birthday has been removed` : `Your birthday has been removed`,
  } satisfies APIEmbed

  return updateInteraction(interaction, env, { embeds: [buildSuccessEmbed('', env, embed)] })
}
