import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, APIEmbed } from 'discord-api-types/v10'
import { buildErrorEmbed, buildSuccessEmbed, fetchUser, findBotCommandMarkdown, updateInteraction } from '@discord-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { useDB } from '@/database/db'
import { getNextBirthdayTimestamp, monthNames, ordinal } from '@/utils/dates'

export const BIRTHDAYS_SHOW_COMMAND = {
  type: 1,
  name: 'show',
  description: 'Show the registered birthday for a user',
  dm_permission: false,
  options: [
    { type: 6, name: 'user', description: 'User to show the birthday for (defaults to yourself)' },
  ],
}

export async function handleBirthdaysShowCommand(interaction: APIApplicationCommandInteraction, option: APIApplicationCommandInteractionDataOption, env: Env) {
  if (option.type !== ApplicationCommandOptionType.Subcommand)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  if (!isGuildInteraction(interaction))
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a guild', env)] })
  const user = (option.options?.find(o => o.name === 'user')?.value as string | undefined) ?? interaction.member.user.id

  if (!user)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid provided user', env)] })

  const serverId = interaction.guild_id

  const birthdayConfig = await useDB(env).query.birthdayConfig.findFirst({
    where: (config, { eq }) => eq(config.guildId, serverId),
  })

  if (!birthdayConfig)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`This server does not have a birthday config setup yet, if you are an admin use ${await findBotCommandMarkdown(env, 'birthdays', 'config', 'setup')} to setup one`, env)] })

  if (birthdayConfig.disabled)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`This server has birthdays disabled, if you are an admin use ${await findBotCommandMarkdown(env, 'birthdays', 'config', 'edit')} to enable them`, env)] })

  const birthday = await useDB(env).query.birthday.findFirst({
    where: (birthday, { eq, and }) => and(eq(birthday.userId, user), eq(birthday.guildId, serverId), eq(birthday.disabled, false)),
  })
  if (!birthday)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('No birthday found for this user', env)] })

  const discordUser = await fetchUser(birthday.userId, env)

  const timezone = birthday.timezone ?? birthdayConfig.timezone ?? 'UTC'

  const birthdayTimestamp = getNextBirthdayTimestamp(birthday.day, birthday.month, timezone)

  const embed = {
    title: '🎉 Birthday',
    description: `<@${user}>'s birthday is on the ${ordinal(birthday.day)} of ${monthNames[birthday.month - 1]}${birthday.year ? ` ${birthday.year}` : ''} ${birthday.timezone ? `(${birthday.timezone})` : ''} \n <t:${birthdayTimestamp}:D> (<t:${birthdayTimestamp}:R>)`,
    color: 0xFF69B4,
    thumbnail: discordUser?.avatar
      ? { url: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` }
      : undefined,
  } satisfies APIEmbed

  return updateInteraction(interaction, env, { embeds: [buildSuccessEmbed('', env, embed)] })
}
