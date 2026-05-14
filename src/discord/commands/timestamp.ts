import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '@discord-api'
import { fromZonedTime } from 'date-fns-tz'
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils'
import { autoCompleteResponse, interactionEphemeralLoading } from '@/discord/interactionHandler'
import { getTimezoneFromQuery, validateTimezone } from '@/utils/dates'

const TIMESTAMP_COMMAND = {
  name: 'timestamp',
  description: 'Create a Discord timestamp for a specific date/time and timezone',
  options: [
    {
      type: 3,
      name: 'date',
      description: 'Date in YYYY-MM-DD format',
      required: true,
    },
    {
      type: 3,
      name: 'time',
      description: 'Time in HH:MM format (24-hour)',
      required: true,
    },
    {
      type: 3,
      name: 'timezone',
      description: 'Timezone in IANA format or UTC offset',
      required: true,
      autocomplete: true,
    },
  ],
  type: 1,
}

function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleTimestampCommand(interaction, env))
  return interactionEphemeralLoading()
}

async function handleTimestampCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction) || !interaction.data.options) {
    return await updateInteraction(interaction, env, {
      embeds: [buildErrorEmbed('Invalid arguments', env)],
    })
  }

  const dateOption = interaction.data.options.find(o => o.name === 'date')
  const timeOption = interaction.data.options.find(o => o.name === 'time')
  const timezoneOption = interaction.data.options.find(o => o.name === 'timezone')

  if (
    !dateOption || !timeOption || !timezoneOption
    || !('value' in dateOption) || !('value' in timeOption) || !('value' in timezoneOption)
  ) {
    return await updateInteraction(interaction, env, {
      embeds: [buildErrorEmbed('Invalid arguments', env)],
    })
  }

  const dateStr = `${dateOption.value}T${timeOption.value}:00`
  const ianaTz = timezoneOption.value as string

  if (!validateTimezone(ianaTz, true)) {
    return await updateInteraction(interaction, env, {
      embeds: [buildErrorEmbed('Timezone is not valid, it should be a valid IANA timezone (e.g. Pacific/Auckland)', env)],
    })
  }

  const localDate = new Date(dateStr)

  if (Number.isNaN(localDate.getTime())) {
    return await updateInteraction(interaction, env, {
      embeds: [buildErrorEmbed('Invalid date/time format, please use - date: \`YYYY-MM-DD\` time: \`HH:MM\`', env)],
    })
  }

  const utcDate = fromZonedTime(localDate, ianaTz)
  const unix = Math.floor(utcDate.getTime() / 1000)

  const styles = [
    { label: 'Short Time', style: 't' },
    { label: 'Long Time', style: 'T' },
    { label: 'Short Date', style: 'd' },
    { label: 'Long Date', style: 'D' },
    { label: 'Short Date/Time', style: 'f' },
    { label: 'Long Date/Time', style: 'F' },
    { label: 'Relative', style: 'R' },
  ]

  const lines = styles.map(({ label, style }) => {
    const ts = `<t:${unix}:${style}>`
    return `**${label}:** ${ts} — \`${ts}\``
  })

  return updateInteraction(interaction, env, {
    embeds: [
      buildSuccessEmbed(
        lines.join('\n'),
        env,
        { title: '✅ Created Timestamps' },
      ),
    ],
  })
}

async function autoCompleteHandler(interaction: APIApplicationCommandAutocompleteInteraction, env: Env, _ctx: ExecutionContext) {
  const timezoneOption = interaction.data.options?.find(option => option.name === 'timezone')
  if (!timezoneOption || !('value' in timezoneOption) || !('focused' in timezoneOption)) {
    return autoCompleteResponse([])
  }

  if (timezoneOption.focused) {
    return autoCompleteResponse(await getTimezoneFromQuery(timezoneOption.value, env, true))
  }
  return autoCompleteResponse([])
}

export default {
  command: TIMESTAMP_COMMAND,
  handler,
  autoCompleteHandler,
} satisfies DiscordAPIApplicationCommand
