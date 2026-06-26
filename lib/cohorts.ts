import type { Order, ProductType, SourceStatus } from '@/types'

export type PlanFilter = 'all' | 'monthly' | 'yearly'

export const MILESTONES = [1, 3, 6, 9, 12] as const

const PLAN_TYPES: Record<PlanFilter, ProductType[] | null> = {
  all: null,
  monthly: ['digital_monthly', 'workbook_monthly', 'workbook_only'],
  yearly: ['digital_yearly', 'digital_semiannual', 'digital_quarterly'],
}

export interface CohortRow {
  label: string
  startMonth: string // YYYY-MM
  size: number
  /** retention fraction at each milestone; null = not enough time elapsed */
  retention: (number | null)[]
}

export interface YoYSeries {
  year: number
  retention: (number | null)[]
}

export interface ChurnPoint {
  bucket: string
  pct: number
}

export interface CohortAnalysis {
  rows: CohortRow[]
  avgRetention: (number | null)[]
  januaryYoY: YoYSeries[]
  churnDistribution: ChurnPoint[]
  /** true when derived from a sample model rather than live orders */
  sampled: boolean
}

const NOW = { year: 2026, month: 5 } // June 2026 (0-indexed month)

function monthIndex(year: number, month0: number) {
  return year * 12 + month0
}
const NOW_IDX = monthIndex(NOW.year, NOW.month)

function quarterLabel(year: number, month0: number) {
  return `Q${Math.floor(month0 / 3) + 1} ${year}`
}
function quarterStartMonth(year: number, month0: number) {
  const q = Math.floor(month0 / 3) * 3
  return `${year}-${String(q + 1).padStart(2, '0')}`
}

// ── Real cohorts from order history ────────────────────────────────
export function buildCohorts(orders: Order[], plan: PlanFilter): CohortAnalysis {
  const allow = PLAN_TYPES[plan]
  const members = new Map<string, number[]>() // customer -> sorted month indices
  for (const o of orders) {
    if (!o.isMembership || o.netSales <= 0) continue
    if (allow && !allow.includes(o.productType)) continue
    const [y, m] = o.date.split('-').map(Number)
    const idx = monthIndex(y, m - 1)
    const arr = members.get(o.customerName) ?? []
    arr.push(idx)
    members.set(o.customerName, arr)
  }

  interface Acc {
    year: number
    month0: number
    size: number
    counts: number[]
  }
  const cohorts = new Map<string, Acc>()
  const janByYear = new Map<number, { size: number; counts: number[] }>()
  const churnCounts = new Map<number, number>()
  let churnTotal = 0

  for (const months of members.values()) {
    const first = Math.min(...months)
    const last = Math.max(...months)
    const tenure = last - first
    const fy = Math.floor(first / 12)
    const fm = first % 12
    const key = quarterStartMonth(fy, fm)

    const acc =
      cohorts.get(key) ??
      ({ year: fy, month0: Math.floor(fm / 3) * 3, size: 0, counts: MILESTONES.map(() => 0) } as Acc)
    acc.size++
    MILESTONES.forEach((m, i) => {
      if (tenure >= m) acc.counts[i]++
    })
    cohorts.set(key, acc)

    if (fm === 0) {
      const j = janByYear.get(fy) ?? { size: 0, counts: MILESTONES.map(() => 0) }
      j.size++
      MILESTONES.forEach((m, i) => {
        if (tenure >= m) j.counts[i]++
      })
      janByYear.set(fy, j)
    }

    // churned = no activity in the last 2 months
    if (last < NOW_IDX - 1) {
      const b = Math.min(tenure, 19)
      churnCounts.set(b, (churnCounts.get(b) ?? 0) + 1)
      churnTotal++
    }
  }

  const rows: CohortRow[] = [...cohorts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([startMonth, a]) => {
      const cohortIdx = monthIndex(a.year, a.month0)
      const elapsed = NOW_IDX - cohortIdx
      return {
        label: quarterLabel(a.year, a.month0),
        startMonth,
        size: a.size,
        retention: MILESTONES.map((m, i) =>
          elapsed >= m && a.size > 0 ? a.counts[i] / a.size : null,
        ),
      }
    })

  return {
    rows,
    avgRetention: averageRetention(rows),
    januaryYoY: [...janByYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, j]) => ({
        year,
        retention: MILESTONES.map((m, i) =>
          NOW_IDX - monthIndex(year, 0) >= m ? j.counts[i] / j.size : null,
        ),
      })),
    churnDistribution: buildChurnBuckets(churnCounts, churnTotal),
    sampled: false,
  }
}

function averageRetention(rows: CohortRow[]): (number | null)[] {
  return MILESTONES.map((_, i) => {
    const vals = rows.map((r) => r.retention[i]).filter((v): v is number => v != null)
    if (!vals.length) return null
    return vals.reduce((s, v) => s + v, 0) / vals.length
  })
}

function buildChurnBuckets(counts: Map<number, number>, total: number): ChurnPoint[] {
  const buckets: { bucket: string; months: number[] }[] = [
    ...Array.from({ length: 12 }, (_, i) => ({ bucket: `${i + 1}`, months: [i + 1] })),
    { bucket: '13–18', months: [13, 14, 15, 16, 17, 18] },
    { bucket: '19+', months: [19] },
  ]
  return buckets.map((b) => {
    const n = b.months.reduce((s, m) => s + (counts.get(m) ?? 0), 0)
    return { bucket: b.bucket, pct: total > 0 ? n / total : 0 }
  })
}

// ── Deterministic sample model (used until live data connects) ─────
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BASE_CURVE: Record<PlanFilter, number[]> = {
  all: [0.81, 0.6, 0.42, 0.33, 0.27],
  monthly: [0.78, 0.55, 0.37, 0.28, 0.22],
  yearly: [0.95, 0.88, 0.8, 0.74, 0.69],
}

export function sampleCohorts(plan: PlanFilter): CohortAnalysis {
  const rng = mulberry32(plan === 'all' ? 11 : plan === 'monthly' ? 22 : 33)
  const base = BASE_CURVE[plan]
  const rows: CohortRow[] = []

  // Q1 2023 → Q2 2026
  let i = 0
  for (let year = 2023; year <= 2026; year++) {
    for (let q = 0; q < 4; q++) {
      const month0 = q * 3
      if (monthIndex(year, month0) > NOW_IDX) continue
      const elapsed = NOW_IDX - monthIndex(year, month0)
      const improve = 1 + i * 0.004 // newer cohorts retain slightly better
      const isJanQ = q === 0
      const size = Math.round((isJanQ ? 120 : 60) * (0.85 + rng() * 0.4))
      rows.push({
        label: quarterLabel(year, month0),
        startMonth: quarterStartMonth(year, month0),
        size,
        retention: MILESTONES.map((m, mi) => {
          if (elapsed < m) return null
          const noise = 0.93 + rng() * 0.14
          return Math.min(0.99, base[mi] * improve * noise)
        }),
      })
      i++
    }
  }

  // January YoY (full-year cohorts get full curves; 2026 partial)
  const januaryYoY: YoYSeries[] = [2023, 2024, 2025, 2026].map((year, yi) => {
    const yr = mulberry32(year)
    const elapsed = NOW_IDX - monthIndex(year, 0)
    const yearFactor = 0.9 + yi * 0.05
    return {
      year,
      retention: MILESTONES.map((m, mi) =>
        elapsed >= m ? Math.min(0.99, base[mi] * yearFactor * (0.95 + yr() * 0.1)) : null,
      ),
    }
  })

  // Churn distribution: month-1 peak, decay, curriculum-year-end bump at 13–18
  const shape = [0.19, 0.12, 0.09, 0.07, 0.06, 0.05, 0.045, 0.04, 0.035, 0.03, 0.028, 0.025, 0.0, 0.0]
  // fold the 13–18 bump and 19+
  const churnDistribution: ChurnPoint[] = [
    ...Array.from({ length: 12 }, (_, m) => ({ bucket: `${m + 1}`, pct: shape[m] })),
    { bucket: '13–18', pct: 0.08 },
    { bucket: '19+', pct: 0.022 },
  ]

  return {
    rows,
    avgRetention: averageRetention(rows),
    januaryYoY,
    churnDistribution,
    sampled: true,
  }
}

export function getCohortAnalysis(
  orders: Order[],
  status: SourceStatus,
  plan: PlanFilter,
): CohortAnalysis {
  if (status === 'connected' && orders.length) return buildCohorts(orders, plan)
  return sampleCohorts(plan)
}
