import dayjs from 'dayjs'

const DATE_FORMAT = 'YYYY-MM-DD'
const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'

/**
 * Normalise a backend time value into a JS Date-parsable input.
 *
 * Jackson serialises Java `LocalDateTime` as an array by default:
 *   [2026, 5, 3, 23, 15, 55, 742030000]
 * This helper converts that array into a standard Date so dayjs can parse it.
 */
function normalise(value: unknown): string | number | Date | undefined {
  if (!value) return undefined
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value
    return new Date(year, month - 1, day, hour, minute, second)
  }
  return value as string | number | Date
}

export function formatDate(value: unknown): string {
  const v = normalise(value)
  if (!v) return ''
  return dayjs(v).format(DATE_FORMAT)
}

export function formatDateTime(value: unknown): string {
  const v = normalise(value)
  if (!v) return ''
  return dayjs(v).format(DATETIME_FORMAT)
}