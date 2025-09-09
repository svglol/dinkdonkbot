import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '@discord-api'
import { format, toZonedTime } from 'date-fns-tz'
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils'
import tzlookup from 'tz-lookup'
import { interactionLoading } from '@/discord/interactionHandler'
import { getGeoData } from '@/utils/geoData'

const WEATHER_COMMAND = {
  name: 'weather',
  description: 'Get the current weather for a location',
  options: [
    {
      type: 3,
      name: 'location',
      description: 'The location to get weather for',
      required: true,
    },
  ],
  type: 1,
}

function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleWeatherCommand(interaction, env))
  return interactionLoading()
}

async function handleWeatherCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

  const locationOption = interaction.data.options?.find(option => option.name === 'location')
  const location = locationOption && 'value' in locationOption ? locationOption.value as string : undefined
  if (!location)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Location must be provided', env)] })

  let lat: number, lon: number, displayName: string, countryCode: string

  try {
    const geoData = await getGeoData(location, env)
    lat = geoData[0].lat
    lon = geoData[0].lon
    displayName = geoData[0].name
    countryCode = geoData[0].address.country_code
  }
  catch {
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`Unable to find location: \`${location}\``, env)] })
  }

  const tzMatch = tzlookup(lat, lon)

  try {
    const weatherCacheKey = `weather:${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`
    const cachedWeather = await env.KV.get(weatherCacheKey)
    let weatherData: {
      current_weather: {
        temperature: number
        windspeed: number
        winddirection: number
        weathercode: number
      }
      daily: {
        temperature_2m_max: number[]
        temperature_2m_min: number[]
      }
      hourly: {
        time: string[]
        relativehumidity_2m: number[]
      }
    }

    if (cachedWeather) {
      weatherData = JSON.parse(cachedWeather)
    }
    else {
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&hourly=relativehumidity_2m&timezone=${tzMatch}`,
      )
      weatherData = await weatherRes.json()
      if (!weatherData.current_weather)
        throw new Error(`Unable to fetch weather data from external API for location: \`${displayName}\`\nThis could be an issue with the API, or the location may not be valid.\nPlease try again later.`)

      await env.KV.put(weatherCacheKey, JSON.stringify(weatherData), { expirationTtl: 3600 }) // 1 hour
    }

    const tempC = weatherData.current_weather.temperature
    const windKmh = weatherData.current_weather.windspeed
    const windDeg = weatherData.current_weather.winddirection
    const weatherCode = weatherData.current_weather.weathercode
    const windCompass = degToCompass(windDeg)

    const daily = weatherData.daily
    const maxTempC = daily.temperature_2m_max[0]
    const minTempC = daily.temperature_2m_min[0]

    const localNow = toZonedTime(new Date(), tzMatch)
    const nowHour = format(localNow, 'yyyy-MM-dd\'T\'HH') // matches API hour format
    const hourly = weatherData.hourly
    const currentHourIndex = hourly.time.findIndex((t: string) => t.startsWith(nowHour))
    const currentHumidity = currentHourIndex !== -1 ? hourly.relativehumidity_2m[currentHourIndex] : null

    const tempF = (tempC * 9 / 5 + 32).toFixed(1)
    const maxTempF = (maxTempC * 9 / 5 + 32).toFixed(1)
    const minTempF = (minTempC * 9 / 5 + 32).toFixed(1)
    const windMph = (windKmh * 0.621371).toFixed(1)

    return updateInteraction(interaction, env, {
      embeds: [
        buildSuccessEmbed('', env, {
          title: `${countryCodeToFlagEmoji(countryCode)} Currently ${tempC} °C / ${tempF} °F in ${displayName}`,
          fields: [
            { name: 'Weather', value: getWeatherDescription(weatherCode), inline: true },
            { name: 'Current Temp', value: `${tempC}°C / ${tempF}°F`, inline: true },
            { name: 'Max', value: `${maxTempC}°C / ${maxTempF}°F`, inline: true },
            { name: 'Min', value: `${minTempC}°C / ${minTempF}°F`, inline: true },
            { name: 'Wind', value: `${windKmh} km/h / ${windMph} mph ${windCompass}`, inline: true },
            { name: 'Humidity', value: currentHumidity !== null ? `${currentHumidity}%` : 'N/A', inline: true },
          ],
        }),
      ],
    })
  }

  catch (error: unknown) {
    if (error instanceof Error) {
      return updateInteraction(interaction, env, { embeds: [buildErrorEmbed(error.message, env)] })
    }
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`Unable to fetch weather for: \`${displayName}\``, env)] })
  }
}

function degToCompass(deg: number) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N']
  return directions[Math.round(deg / 45)]
}

function getWeatherDescription(code: number) {
  const map: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Drizzle: Light',
    53: 'Drizzle: Moderate',
    55: 'Drizzle: Dense',
    56: 'Freezing Drizzle: Light',
    57: 'Freezing Drizzle: Dense',
    61: 'Rain: Slight',
    63: 'Rain: Moderate',
    65: 'Rain: Heavy',
    66: 'Freezing Rain: Light',
    67: 'Freezing Rain: Heavy',
    71: 'Snow fall: Slight',
    73: 'Snow fall: Moderate',
    75: 'Snow fall: Heavy',
    77: 'Snow grains',
    80: 'Rain showers: Slight',
    81: 'Rain showers: Moderate',
    82: 'Rain showers: Violent',
    85: 'Snow showers slight',
    86: 'Snow showers heavy',
    95: 'Thunderstorm: Slight or moderate',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  }
  return map[code] || 'Unknown'
}

function countryCodeToFlagEmoji(countryCode: string) {
  return countryCode.toUpperCase().replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)))
}

export default {
  command: WEATHER_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
