import type { Order, ProductType, SourceStatus } from '@/types'

const PLAN_ORDER: ProductType[] = [
  'digital_monthly',
  'digital_yearly',
  'digital_semiannual',
  'digital_quarterly',
  'workbook_monthly',
  'workbook_only',
]
const SHORT_LABEL: Record<string, string> = {
  digital_monthly: 'Digital Monthly',
  digital_yearly: 'Digital Yearly',
  digital_semiannual: 'Semiannual',
  digital_quarterly: 'Quarterly',
  workbook_monthly: 'Workbook Monthly',
  workbook_only: 'Workbook Only',
}
const MONTHLY_TYPES: ProductType[] = ['digital_monthly', 'workbook_monthly', 'workbook_only']

export interface LtvByPlan {
  type: string
  label: string
  avgLtv: number
  medianLtv: number
  avgTenure: number
  count: number
}
export interface LtvBucket {
  range: string
  count: number
}
export interface NamedCount {
  label: string
  count: number
}
export interface LtvAnalysis {
  avgLtv: number
  medianLtv: number
  byPlan: LtvByPlan[]
  distribution: LtvBucket[]
  concentration: { top10: number; top20: number }
  upgrade: {
    pctFromMonthly: number
    timing: NamedCount[]
    calendar: NamedCount[]
  }
  sampled: boolean
}

function median(nums: number[]): number {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
function mean(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}
function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const LTV_BUCKETS: { range: string; min: number; max: number }[] = [
  { range: '$0–50', min: 0, max: 50 },
  { range: '$51–100', min: 50, max: 100 },
  { range: '$101–200', min: 100, max: 200 },
  { range: '$201–400', min: 200, max: 400 },
  { range: '$401+', min: 400, max: Infinity },
]
const TIMING_BUCKETS = ['1–2 mo', '3–4 mo', '5–6 mo', '7–12 mo', '12+ mo']
function timingBucket(m: number): string {
  if (m <= 2) return '1–2 mo'
  if (m <= 4) return '3–4 mo'
  if (m <= 6) return '5–6 mo'
  if (m <= 12) return '7–12 mo'
  return '12+ mo'
}

// ── Real LTV from order history ────────────────────────────────────
export function buildLtv(orders: Order[]): LtvAnalysis {
  interface Cust {
    ltv: number
    firstPlan: ProductType
    firstDate: string
    lastDate: string
    firstMonthlyDate?: string
    firstAnnualDate?: string
  }
  const custs = new Map<string, Cust>()

  for (const o of [...orders].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!o.isMembership || o.netSales <= 0) continue
    const c = custs.get(o.customerName)
    if (!c) {
      custs.set(o.customerName, {
        ltv: o.netSales,
        firstPlan: o.productType,
        firstDate: o.date,
        lastDate: o.date,
        firstMonthlyDate: MONTHLY_TYPES.includes(o.productType) ? o.date : undefined,
        firstAnnualDate: o.productType === 'digital_yearly' ? o.date : undefined,
      })
    } else {
      c.ltv += o.netSales
      c.lastDate = o.date
      if (!c.firstMonthlyDate && MONTHLY_TYPES.includes(o.productType)) c.firstMonthlyDate = o.date
      if (!c.firstAnnualDate && o.productType === 'digital_yearly') c.firstAnnualDate = o.date
    }
  }

  const all = [...custs.values()]
  const ltvs = all.map((c) => c.ltv)

  // by plan
  const byPlan: LtvByPlan[] = PLAN_ORDER.map((type) => {
    const members = all.filter((c) => c.firstPlan === type)
    return {
      type,
      label: SHORT_LABEL[type],
      avgLtv: Math.round(mean(members.map((m) => m.ltv))),
      medianLtv: Math.round(median(members.map((m) => m.ltv))),
      avgTenure: Math.round(mean(members.map((m) => monthsBetween(m.firstDate, m.lastDate))) * 10) / 10,
      count: members.length,
    }
  }).filter((p) => p.count > 0)

  // distribution
  const distribution: LtvBucket[] = LTV_BUCKETS.map((b) => ({
    range: b.range,
    count: ltvs.filter((v) => v >= b.min && v < b.max).length,
  }))

  // concentration (Pareto)
  const sorted = [...ltvs].sort((a, b) => b - a)
  const total = sorted.reduce((a, b) => a + b, 0) || 1
  const sumTop = (frac: number) =>
    sorted.slice(0, Math.max(1, Math.round(sorted.length * frac))).reduce((a, b) => a + b, 0)
  const concentration = {
    top10: sumTop(0.1) / total,
    top20: sumTop(0.2) / total,
  }

  // upgrades
  const annual = all.filter((c) => c.firstAnnualDate)
  const upgraders = annual.filter(
    (c) => c.firstMonthlyDate && c.firstMonthlyDate < (c.firstAnnualDate as string),
  )
  const timingCounts = new Map<string, number>(TIMING_BUCKETS.map((b) => [b, 0]))
  const calCounts = new Map<string, number>(MONTHS.map((m) => [m, 0]))
  for (const u of upgraders) {
    const months = monthsBetween(u.firstMonthlyDate as string, u.firstAnnualDate as string)
    timingCounts.set(timingBucket(months), (timingCounts.get(timingBucket(months)) ?? 0) + 1)
    const calMonth = MONTHS[Number((u.firstAnnualDate as string).split('-')[1]) - 1]
    calCounts.set(calMonth, (calCounts.get(calMonth) ?? 0) + 1)
  }

  return {
    avgLtv: Math.round(mean(ltvs)),
    medianLtv: Math.round(median(ltvs)),
    byPlan,
    distribution,
    concentration,
    upgrade: {
      pctFromMonthly: annual.length ? upgraders.length / annual.length : 0,
      timing: TIMING_BUCKETS.map((b) => ({ label: b, count: timingCounts.get(b) ?? 0 })),
      calendar: MONTHS.map((m) => ({ label: m, count: calCounts.get(m) ?? 0 })),
    },
    sampled: false,
  }
}

// ── Deterministic sample model ─────────────────────────────────────
export function sampleLtv(): LtvAnalysis {
  const byPlan: LtvByPlan[] = [
    { type: 'digital_monthly', label: 'Digital Monthly', avgLtv: 96, medianLtv: 72, avgTenure: 8, count: 612 },
    { type: 'digital_yearly', label: 'Digital Yearly', avgLtv: 186, medianLtv: 165, avgTenure: 14.5, count: 188 },
    { type: 'digital_semiannual', label: 'Semiannual', avgLtv: 112, medianLtv: 96, avgTenure: 9.5, count: 74 },
    { type: 'digital_quarterly', label: 'Quarterly', avgLtv: 74, medianLtv: 60, avgTenure: 6.5, count: 53 },
    { type: 'workbook_monthly', label: 'Workbook Monthly', avgLtv: 168, medianLtv: 140, avgTenure: 9.5, count: 141 },
    { type: 'workbook_only', label: 'Workbook Only', avgLtv: 88, medianLtv: 70, avgTenure: 7, count: 96 },
  ]
  return {
    avgLtv: 118,
    medianLtv: 84,
    byPlan,
    distribution: [
      { range: '$0–50', count: 318 },
      { range: '$51–100', count: 402 },
      { range: '$101–200', count: 286 },
      { range: '$201–400', count: 121 },
      { range: '$401+', count: 37 },
    ],
    concentration: { top10: 0.32, top20: 0.51 },
    upgrade: {
      pctFromMonthly: 0.58,
      timing: [
        { label: '1–2 mo', count: 22 },
        { label: '3–4 mo', count: 48 },
        { label: '5–6 mo', count: 31 },
        { label: '7–12 mo', count: 27 },
        { label: '12+ mo', count: 14 },
      ],
      calendar: MONTHS.map((m) => ({
        label: m,
        count: { Jan: 41, May: 28, Aug: 33 }[m] ?? 6 + ((m.charCodeAt(0) * 7) % 9),
      })),
    },
    sampled: true,
  }
}

export function getLtvAnalysis(orders: Order[], status: SourceStatus): LtvAnalysis {
  if (status === 'connected' && orders.length) return buildLtv(orders)
  return sampleLtv()
}
