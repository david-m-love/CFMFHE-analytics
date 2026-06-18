import {
  endOfMonth,
  endOfQuarter,
  format,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subYears,
} from 'date-fns'
import type { DateRange } from '@/types'

export type QuickSelect =
  | 'last_7'
  | 'last_14'
  | 'last_30'
  | 'last_60'
  | 'last_90'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'ytd'
  | 'custom'

export const QUICK_SELECT_LABELS: Record<QuickSelect, string> = {
  last_7: 'Last 7 days',
  last_14: 'Last 14 days',
  last_30: 'Last 30 days',
  last_60: 'Last 60 days',
  last_90: 'Last 90 days',
  this_month: 'This month',
  last_month: 'Last month',
  this_quarter: 'This quarter',
  last_quarter: 'Last quarter',
  ytd: 'Year to date',
  custom: 'Custom range…',
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

export function resolveQuickSelect(q: QuickSelect, today = new Date()): DateRange {
  switch (q) {
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
    case 'this_month':
      return { from: iso(startOfMonth(today)), to: iso(today) }
    case 'last_month': {
      const lm = subMonths(today, 1)
      return { from: iso(startOfMonth(lm)), to: iso(endOfMonth(lm)) }
    }
    case 'this_quarter':
      return { from: iso(startOfQuarter(today)), to: iso(today) }
    case 'last_quarter': {
      const lq = subQuarters(today, 1)
      return { from: iso(startOfQuarter(lq)), to: iso(endOfQuarter(lq)) }
    }
    case 'ytd':
      return { from: iso(startOfYear(today)), to: iso(today) }
    case 'custom':
    default:
      return { from: iso(subDays(today, 29)), to: iso(today) }
  }
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
  return `${fmtFrom} – ${fmtTo}`
}
