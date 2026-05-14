import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import tzlookup from 'tz-lookup'
import { getGeoData } from '@/utils/geoData'

export const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

export function getNextBirthdayTimestamp(day: number, month: number, timezone: string): number {
  const now = new Date()
  const nowInTimezone = toZonedTime(now, timezone)
  const todayDay = nowInTimezone.getDate()
  const todayMonth = nowInTimezone.getMonth() + 1
  const todayYear = nowInTimezone.getFullYear()

  const isToday = day === todayDay && month === todayMonth
  const isPast = !isToday && (month < todayMonth || (month === todayMonth && day < todayDay))
  const year = isPast ? todayYear + 1 : todayYear

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`
  return Math.floor(fromZonedTime(new Date(dateStr), timezone).getTime() / 1000)
}

const UTC_OFFSETS = Array.from({ length: 27 }, (_, i) => i - 13).map(offset => ({
  name: offset === 0 ? 'UTC' : `UTC${offset > 0 ? '+' : ''}${offset}`,
  value: offset === 0 ? 'Etc/GMT' : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`,
}))

export async function getTimezoneFromQuery(rawQuery: string, env: Env, includeUtcOffsets = false) {
  const query = String(rawQuery).toLowerCase().replace(/\s+/g, '_')
  const matches = Intl.supportedValuesOf('timeZone')
    .filter(tz => tz.toLowerCase().replace(/^[^/]+\//, '').includes(query))
    .slice(0, 25)
    .map(tz => ({ name: tz, value: tz }))

  if (includeUtcOffsets) {
    const utcMatches = UTC_OFFSETS
      .filter(tz => tz.name.toLowerCase().includes(query) && !matches.some(m => m.value === tz.value))
    matches.unshift(...utcMatches)
  }

  try {
    const geoData = await getGeoData(rawQuery, env)
    const tzMatch = tzlookup(geoData[0].lat, geoData[0].lon)
    if (tzMatch && !matches.some(m => m.value === tzMatch)) {
      matches.unshift({ name: tzMatch, value: tzMatch })
    }
  }
  catch {
    // geodata lookup failed, continue with existing matches
  }
  return matches.slice(0, 25)
}

export function validateTimezone(timezone: string, includeUtcOffsets = false) {
  const validUtc = includeUtcOffsets && UTC_OFFSETS.some(tz => tz.value === timezone)
  return validUtc || Intl.supportedValuesOf('timeZone').includes(timezone)
}
