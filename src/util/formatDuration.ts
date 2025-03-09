/**
 * Converts a duration from milliseconds to a human-readable format.
 *
 * @param durationInMilliseconds - The duration in milliseconds to be formatted.
 * @returns A string representing the duration in hours, minutes, and seconds.
 *          The format will be 'XhYmZs', where X, Y, and Z are the number of
 *          hours, minutes, and seconds respectively. Parts with zero values
 *          are omitted.
 */

export function formatDuration(durationInMilliseconds: number) {
  const seconds = Math.floor(durationInMilliseconds / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  const formattedHours = hours > 0 ? `${hours}h` : ''
  const formattedMinutes = minutes > 0 ? `${minutes}m` : ''
  const formattedSeconds = remainingSeconds > 0 ? `${remainingSeconds}s` : ''

  return `${formattedHours}${formattedMinutes}${formattedSeconds}`
}
