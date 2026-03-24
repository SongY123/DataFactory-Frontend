export const APP_TIMEZONE = 'Asia/Shanghai'
export const APP_TIMEZONE_LABEL = 'UTC+8'
export const APP_TIMEZONE_OFFSET_MINUTES = 8 * 60

const NAIVE_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2})(?::(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?)?)?$/
const EXPLICIT_TIMEZONE_RE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/
const NULL_LIKE_VALUES = new Set(['', '-', 'none', 'null', 'undefined'])

const pad = (value) => String(value).padStart(2, '0')

const normalizeRawDateTime = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  }
  return String(value ?? '').trim()
}

const isNullLikeDateTime = (raw) => NULL_LIKE_VALUES.has(String(raw || '').trim().toLowerCase())

const fractionToMilliseconds = (fraction = '') => {
  const normalized = String(fraction || '').slice(0, 3).padEnd(3, '0')
  return normalized ? Number(normalized) : 0
}

export const parseAppDateTime = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime())
  }

  const raw = normalizeRawDateTime(value)
  if (!raw || isNullLikeDateTime(raw)) return null

  if (EXPLICIT_TIMEZONE_RE.test(raw)) {
    const direct = new Date(raw)
    return Number.isNaN(direct.getTime()) ? null : direct
  }

  const naiveMatch = raw.match(NAIVE_DATETIME_RE)
  if (naiveMatch) {
    const [
      ,
      year,
      month,
      day,
      hour = '00',
      minute = '00',
      second = '00',
      fraction = '0'
    ] = naiveMatch

    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
        fractionToMilliseconds(fraction)
      )
    )
  }

  const fallbackValue = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw
  const fallbackDate = new Date(fallbackValue)
  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate
}

export const toAppTimestamp = (value, fallback = 0) => {
  const parsed = parseAppDateTime(value)
  return parsed ? parsed.getTime() : fallback
}

export const formatAppDateTime = (value, options = {}) => {
  const {
    fallback = '-',
    includeSeconds = true
  } = options

  const raw = normalizeRawDateTime(value)
  if (!raw || isNullLikeDateTime(raw)) return fallback

  const parsed = parseAppDateTime(raw)
  if (!parsed) {
    const normalized = raw.replace('T', ' ')
    return normalized.slice(0, includeSeconds ? 19 : 16) || fallback
  }

  const timezoneDate = new Date(parsed.getTime() + APP_TIMEZONE_OFFSET_MINUTES * 60 * 1000)
  const datePart = [
    timezoneDate.getUTCFullYear(),
    pad(timezoneDate.getUTCMonth() + 1),
    pad(timezoneDate.getUTCDate())
  ].join('-')
  const timePart = [
    pad(timezoneDate.getUTCHours()),
    pad(timezoneDate.getUTCMinutes()),
    includeSeconds ? pad(timezoneDate.getUTCSeconds()) : null
  ].filter(Boolean).join(':')

  return `${datePart} ${timePart}`.trim()
}
