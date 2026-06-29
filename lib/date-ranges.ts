import {
  addDays,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  getQuarter,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
} from 'date-fns'
import type { DateRange } from '@/types'

// Named presets plus dynamic pattern keys: `q:YYYY:N` (a specific quarter) and
// `bfcm:YYYY` (Black Friday → Cyber Monday weekend). The `& {}` keeps literal
// autocomplete while allowing the pattern strings.
export type NamedQuickSelect =
  | 'today'
  | 'yesterday'
  | 'last_7'
  | 'last_14'
  | 'last_30'
  | 'last_60'
  | 'last_90'
  | 'last_365'
  | 'last_week'
  | 'last_month'
  | 'last_quarter'
  | 'last_12_months'
  | 'last_year'
  | 'wtd'
  | 'mtd'
  | 'qtd'
  | 'ytd'
  | 'this_month'
  | 'this_quarter'
  | 'custom'
// eslint-disable-next-line @typescript-eslint/ban-types
export type QuickSelect = NamedQuickSelect | (string & {})

const NAMED_LABELS: Record<NamedQuickSelect, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last_7: 'Last 7 days',
  last_14: 'Last 14 days',
  last_30: 'Last 30 days',
  last_60: 'Last 60 days',
  last_90: 'Last 90 days',
  last_365: 'Last 365 days',
  last_week: 'Last week',
  last_month: 'Last month',
  last_quarter: 'Last quarter',
  last_12_months: 'Last 12 months',
  last_year: 'Last year',
  wtd: 'Week to date',
  mtd: 'Month to date',
  qtd: 'Quarter to date',
  ytd: 'Year to date',
  this_month: 'Month to date',
  this_quarter: 'Quarter to date',
  custom: 'Fixed dates…',
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

export function quickSelectLabel(q: QuickSelect): string {
  const qm = /^q:(\d{4}):([1-4])$/.exec(q)
  if (qm) return `Q${qm[2]} ${qm[1]}`
  const bm = /^bfcm:(\d{4})$/.exec(q)
  if (bm) return `BFCM ${bm[1]}`
  return NAMED_LABELS[q as NamedQuickSelect] ?? 'Custom range'
}

/** 4th Thursday of November = US Thanksgiving. */
function thanksgiving(year: number): Date {
  const nov1 = new Date(year, 10, 1)
  const firstThu = 1 + ((4 - nov1.getDay() + 7) % 7)
  return new Date(year, 10, firstThu + 21)
}

/** Black Friday → Cyber Monday for a given year. */
function bfcmRange(year: number): DateRange {
  const t = thanksgiving(year)
  return { from: iso(addDays(t, 1)), to: iso(addDays(t, 4)) }
}

export function resolveQuickSelect(q: QuickSelect, today = new Date()): DateRange {
  const qm = /^q:(\d{4}):([1-4])$/.exec(q)
  if (qm) {
    const start = startOfQuarter(new Date(+qm[1], (+qm[2] - 1) * 3, 1))
    const end = endOfQuarter(start)
    return { from: iso(start), to: iso(end > today ? today : end) }
  }
  const bm = /^bfcm:(\d{4})$/.exec(q)
  if (bm) return bfcmRange(+bm[1])

  switch (q) {
    case 'today':
      return { from: iso(today), to: iso(today) }
    case 'yesterday': {
      const y = subDays(today, 1)
      return { from: iso(y), to: iso(y) }
    }
    case 'last_7':
      return { from: iso(subDays(today, 6)), to: iso(today) }
    case 'last_14':
      return { from: iso(subDays(today, 13)), to: iso(today) }
    case 'last_30':
      return { from: iso(subDays(today, 29)), to: iso(today) }
    case 'last_60':
      return { from: iso(subDays(today, 59)), to: iso(today) }
    case 'last_90':
      return { from: iso(subDays(today, 89)), to: iso(today) }
    case 'last_365':
      return { from: iso(subDays(today, 364)), to: iso(today) }
    case 'last_week': {
      const lw = subWeeks(today, 1)
      return { from: iso(startOfWeek(lw)), to: iso(endOfWeek(lw)) }
    }
    case 'last_month': {
      const lm = subMonths(today, 1)
      return { from: iso(startOfMonth(lm)), to: iso(endOfMonth(lm)) }
    }
    case 'last_quarter': {
      const lq = subQuarters(today, 1)
      return { from: iso(startOfQuarter(lq)), to: iso(endOfQuarter(lq)) }
    }
    case 'last_12_months':
      return { from: iso(subMonths(today, 12)), to: iso(today) }
    case 'last_year': {
      const ly = subYears(today, 1)
      return { from: iso(startOfYear(ly)), to: iso(endOfYear(ly)) }
    }
    case 'wtd':
      return { from: iso(startOfWeek(today)), to: iso(today) }
    case 'mtd':
    case 'this_month':
      return { from: iso(startOfMonth(today)), to: iso(today) }
    case 'qtd':
    case 'this_quarter':
      return { from: iso(startOfQuarter(today)), to: iso(today) }
    case 'ytd':
      return { from: iso(startOfYear(today)), to: iso(today) }
    case 'custom':
    default:
      return { from: iso(subDays(today, 29)), to: iso(today) }
  }
}

// ── Dynamic preset generators for the picker ───────────────────────────────
export interface PresetOption {
  key: QuickSelect
  label: string
}

/** The current quarter and the previous (n−1) quarters, newest first. */
export function recentQuarters(today = new Date(), n = 4): PresetOption[] {
  let year = today.getFullYear()
  let q = getQuarter(today)
  const out: PresetOption[] = []
  for (let i = 0; i < n; i++) {
    out.push({ key: `q:${year}:${q}`, label: `Q${q} ${year}` })
    q -= 1
    if (q < 1) {
      q = 4
      year -= 1
    }
  }
  return out
}

/** The n most recent BFCM weekends whose start date has already occurred. */
export function recentBfcmYears(today = new Date(), n = 4): PresetOption[] {
  let year = today.getFullYear()
  const out: PresetOption[] = []
  let guard = 0
  while (out.length < n && guard < 12) {
    guard += 1
    const r = bfcmRange(year)
    if (new Date(r.from) <= today) out.push({ key: `bfcm:${year}`, label: `BFCM ${year}` })
    year -= 1
  }
  return out
}

/** Comparison range: previous period (shifted back) or previous year. */
export function resolveCompare(
  range: DateRange,
  mode: 'previous_period' | 'previous_year',
): DateRange {
  const from = new Date(range.from)
  const to = new Date(range.to)
  if (mode === 'previous_year') {
    return { from: iso(subYears(from, 1)), to: iso(subYears(to, 1)) }
  }
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
  return { from: iso(subDays(from, days)), to: iso(subDays(to, days)) }
}

export function formatRangeLabel(range: DateRange): string {
  const from = new Date(range.from)
  const to = new Date(range.to)
  const sameYear = from.getUTCFullYear() === to.getUTCFullYear()
  const fmtFrom = format(from, sameYear ? 'MMM d' : 'MMM d, yyyy')
  const fmtTo = format(to, 'MMM d, yyyy')
  if (range.from === range.to) return format(from, 'MMM d, yyyy')
  return `${fmtFrom} – ${fmtTo}`
}
