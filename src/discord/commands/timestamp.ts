import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { fromZonedTime } from 'date-fns-tz'
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const TIMESTAMP_COMMAND = {
  name: 'timestamp',
  description: 'Create a Discord timestamp for a specific date/time and UTC offset',
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
      name: 'utc_offset',
      description: 'UTC offset (e.g., UTC+0, UTC+5, UTC-5)',
      required: true,
    },
    {
      type: 3,
      name: 'style',
      description: 'Optional timestamp style',
      required: false,
      choices: [
        { name: 'Short Time', value: 't' },
        { name: 'Long Time', value: 'T' },
        { name: 'Short Date', value: 'd' },
        { name: 'Long Date', value: 'D' },
        { name: 'Short Date/Time', value: 'f' },
        { name: 'Long Date/Time', value: 'F' },
        { name: 'Relative', value: 'R' },
      ],
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
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
      embeds: [buildErrorEmbed('Invalid arguments', env)],
    })
  }

  const dateOption = interaction.data.options.find(o => o.name === 'date')
  const timeOption = interaction.data.options.find(o => o.name === 'time')
  const offsetOption = interaction.data.options.find(o => o.name === 'utc_offset')
  const styleOption = interaction.data.options.find(o => o.name === 'style')

  if (!dateOption || !timeOption || !offsetOption || !('value' in dateOption) || !('value' in timeOption) || !('value' in offsetOption)) {
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
      embeds: [buildErrorEmbed('Invalid arguments', env)],
    })
  }

  const dateStr = `${dateOption.value}T${timeOption.value}:00`
  const utcInput = (offsetOption.value as string).toUpperCase()
  const style = styleOption && 'value' in styleOption ? styleOption.value as string : 'f'

  // Validate UTC offset format (UTC+/-X)
  const match = utcInput.match(/^UTC([+-]\d{1,2})$/)
  if (!match) {
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
      embeds: [buildErrorEmbed('Invalid UTC offset format. Use e.g. `UTC+0`, `UTC+5`, `UTC-5`', env)],
    })
  }

  const offset = Number.parseInt(match[1], 10)

  const ianaTz = offset === 0 ? 'Etc/GMT' : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`

  const localDate = new Date(dateStr)

  if (Number.isNaN(localDate.getTime())) {
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
      embeds: [buildErrorEmbed('Invalid date/time format, please use - date: \`YYYY-MM-DD\` time: \`HH:MM\`', env)],
    })
  }
  const utcDate = fromZonedTime(localDate, ianaTz)
  const unix = Math.floor(utcDate.getTime() / 1000)
  const discordTimestamp = `<t:${unix}:${style}>`

  return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
    embeds: [
      buildSuccessEmbed(
        `Preview: ${discordTimestamp}\nTimestamp: \`${discordTimestamp}\`\nYou can copy and paste this into any message on Discord.`,
        env,
        { title: '✅ Created Timestamp' },
      ),
    ],
  })
}

export default {
  command: TIMESTAMP_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
