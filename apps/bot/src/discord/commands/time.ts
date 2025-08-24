import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { formatInTimeZone } from 'date-fns-tz'
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils'
import tzlookup from 'tz-lookup'
import { getGeoData } from '../../util/geoData'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '../discord'
import { interactionLoading } from '../interactionHandler'

const TIME_COMMAND = {
  name: 'time',
  description: 'Get the current time for a location',
  options: [
    {
      type: 3,
      name: 'location',
      description: 'The location to get the time for',
      required: true,
    },
  ],
  type: 1,
}

function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleTimeCommand(interaction, env))
  return interactionLoading()
}

async function handleTimeCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
  if (!interaction.data.options)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
  const locationOption = interaction.data.options.find(option => option.name === 'location')
  if (!locationOption)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Location must be provided', env)] })
  const location = 'value' in locationOption ? locationOption.value as string : undefined
  if (!location)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Location must be provided', env)] })

  let lat: number
  let lon: number
  let displayName: string
  let countryCode: string
  try {
    const geoData = await getGeoData(location, env)
    lat = geoData[0].lat
    lon = geoData[0].lon
    displayName = geoData[0].name
    countryCode = geoData[0].address.country_code
  }
  // eslint-disable-next-line unused-imports/no-unused-vars
  catch (error: unknown) {
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`Unable to find location: \`${location}\``, env)] })
  }

  const tzMatch = tzlookup(lat, lon)

  const date = new Date()
  const time = formatInTimeZone(date, tzMatch, 'hh:mm:ss a') // 12-hour time with AM/PM
  const offset = formatInTimeZone(date, tzMatch, 'xxx') // +00:00
  const dateString = formatInTimeZone(date, tzMatch, 'EEEE, MMMM do, yyyy') // Thursday, August 14th, 2025

  if (time) {
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(`**Time**: \`${time}\`\n**Date**: \`${dateString}\`\n**Timezone**: \`${tzMatch} ${offset}\``, env, { title: `${countryCodeToFlagEmoji(countryCode)} ${displayName}` })] })
  }

  return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Unable to get time for that location', env)] })
}

function countryCodeToFlagEmoji(countryCode: string) {
  return countryCode
    .toUpperCase()
    .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)))
}

export default {
  command: TIME_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
