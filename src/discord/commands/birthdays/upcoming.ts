import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import { buildErrorEmbed, updateInteraction } from '@discord-api'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { useDB } from '@/database/db'
import { getNextBirthdayTimestamp, monthNames, ordinal } from '@/utils/dates'

export const BIRTHDAYS_UPCOMING_COMMAND = {
  type: 1,
  name: 'upcoming',
  dm_permission: false,
  description: 'Show upcoming birthdays in this server',
}

export async function handleBirthdaysUpcomingCommand(interaction: APIApplicationCommandInteraction, option: APIApplicationCommandInteractionDataOption, env: Env) {
  if (option.type !== ApplicationCommandOptionType.Subcommand)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  if (!isGuildInteraction(interaction))
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })

  const guildId = interaction.guild_id || ''
  const birthdayConfig = await useDB(env).query.birthdayConfig.findFirst({
    where: (config, { eq, and }) => and(eq(config.guildId, guildId), eq(config.disabled, false)),
    with: { birthdays: { where: (b, { eq }) => eq(b.disabled, false) } },
  })

  if (!birthdayConfig) {
    return updateInteraction(interaction, env, {
      embeds: [buildErrorEmbed('No birthday config found for this server', env)],
    })
  }

  const now = new Date()

  const upcoming = birthdayConfig.birthdays
    .map((b) => {
      const timezone = b.timezone || birthdayConfig.timezone || 'UTC'
      const nowInTimezone = toZonedTime(now, timezone)
      const todayMonth = nowInTimezone.getMonth() + 1
      const todayDay = nowInTimezone.getDate()
      const todayYear = nowInTimezone.getFullYear()

      const isPast = b.month < todayMonth || (b.month === todayMonth && b.day < todayDay)
      const birthdayYear = isPast ? todayYear + 1 : todayYear
      const dateStr = `${birthdayYear}-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}T00:00:00`
      const nextOccurrence = fromZonedTime(new Date(dateStr), timezone)

      const isToday = b.month === todayMonth && b.day === todayDay
      const daysUntil = isToday
        ? 0
        : Math.ceil((nextOccurrence.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      const age = b.year ? birthdayYear - b.year : null
      return { ...b, nextOccurrence, daysUntil, age }
    })
    .filter(b => b.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)

  const content = upcoming.map((b) => {
    const discordTimestamp = `<t:${getNextBirthdayTimestamp(b.day, b.month, b.timezone || birthdayConfig.timezone || 'UTC')}:R>`
    const dateStr = `${monthNames[b.month - 1]} ${ordinal(b.day)}`
    const ageStr = b.age ? ` (turns ${b.age})` : ''
    return `- <@${b.userId}> - ${dateStr}${ageStr} • ${discordTimestamp}`
  }).join('\n')

  const upcomingCard = {
    type: 17,
    accent_color: 0xFF69B4,
    components: [
      {
        type: 10,
        content: `## 🎂 Upcoming Birthdays \n*Next 30 days*`,
      },
      {
        type: 10,
        content: upcoming.length === 0 ? 'No birthdays found in the next 30 days 😢' : content,
      },
    ],
  } satisfies APIMessageTopLevelComponent

  return updateInteraction(interaction, env, {
    flags: 1 << 15,
    components: [upcomingCard],
  })
}
