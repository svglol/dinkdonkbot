import { fromZonedTime, toZonedTime } from 'date-fns-tz'

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
