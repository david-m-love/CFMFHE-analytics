import type { Order, ProductType } from '@/types'
import { PRODUCT_TYPE_LABELS } from '@/types'

const MEMBERSHIP_MONTHLY_VALUE: Partial<Record<ProductType, number>> = {
  digital_monthly: 12,
  digital_yearly: 110 / 12,
  digital_semiannual: 55 / 6,
  digital_quarterly: 30 / 3,
  workbook_monthly: 25,
  workbook_only: 14.95,
}

export function totalRevenue(orders: Order[]): number {
  return round(orders.reduce((s, o) => s + o.netSales, 0))
}

export function membershipRevenue(orders: Order[]): number {
  return round(
    orders.filter((o) => o.isMembership).reduce((s, o) => s + o.netSales, 0),
  )
}

/** New members = first paid (non-trial) membership order from a new customer. */
export function newMembers(orders: Order[]): number {
  return orders.filter(
    (o) => o.isMembership && o.customerType === 'new' && !o.isFreeTrial && o.netSales > 0,
  ).length
}

/** Count of returning-customer paid membership orders (complements newMembers). */
export function returningMembers(orders: Order[]): number {
  return orders.filter(
    (o) => o.isMembership && o.customerType !== 'new' && o.netSales > 0,
  ).length
}

export function freeTrialStarts(orders: Order[]): number {
  return orders.filter((o) => o.isFreeTrial).length
}

/** Trial → paid conversion estimate within the window. */
export function trialConversionRate(orders: Order[]): number {
  const trials = freeTrialStarts(orders)
  const paid = newMembers(orders)
  const denom = trials + paid
  return denom === 0 ? 0 : paid / denom
}

/** Estimated active members: distinct recent membership purchasers. */
export function estimatedActiveMembers(orders: Order[]): number {
  const names = new Set(
    orders.filter((o) => o.isMembership && o.netSales > 0).map((o) => o.customerName),
  )
  return names.size
}

/** Rough MRR from membership orders in the window, normalized to monthly value. */
export function estimatedMrr(orders: Order[]): number {
  return round(
    orders
      .filter((o) => o.isMembership && o.netSales > 0)
      .reduce((s, o) => s + (MEMBERSHIP_MONTHLY_VALUE[o.productType] ?? o.netSales), 0),
  )
}

/** Membership revenue from first-time (new-customer) paid orders. */
export function newMemberRevenue(orders: Order[]): number {
  return round(
    orders
      .filter((o) => o.isMembership && o.customerType === 'new' && !o.isFreeTrial && o.netSales > 0)
      .reduce((s, o) => s + o.netSales, 0),
  )
}

/** Membership revenue from returning customers (renewals / repeat). */
export function returningMemberRevenue(orders: Order[]): number {
  return round(
    orders
      .filter((o) => o.isMembership && o.customerType !== 'new' && o.netSales > 0)
      .reduce((s, o) => s + o.netSales, 0),
  )
}

export interface MonthlyRevenuePoint {
  month: string // YYYY-MM
  label: string
  newRevenue: number
  returningRevenue: number
  total: number
  isJanuary: boolean
}

/** Monthly revenue split by new vs returning, last `count` months. */
export function monthlyRevenue(orders: Order[], count = 12): MonthlyRevenuePoint[] {
  const map = new Map<string, MonthlyRevenuePoint>()
  for (const o of orders) {
    const month = o.date.slice(0, 7)
    let pt = map.get(month)
    if (!pt) {
      const [y, m] = month.split('-').map(Number)
      pt = {
        month,
        label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        }),
        newRevenue: 0,
        returningRevenue: 0,
        total: 0,
        isJanuary: m === 1,
      }
      map.set(month, pt)
    }
    if (o.customerType === 'returning') pt.returningRevenue += o.netSales
    else pt.newRevenue += o.netSales
    pt.total += o.netSales
  }
  const arr = [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
  arr.forEach((p) => {
    p.newRevenue = round(p.newRevenue)
    p.returningRevenue = round(p.returningRevenue)
    p.total = round(p.total)
  })
  return arr.slice(-count)
}

export interface PlanMixSlice {
  type: ProductType
  label: string
  value: number
}

/** Plan-mix breakdown (membership order counts) for a donut. */
export function planMix(orders: Order[]): PlanMixSlice[] {
  const counts = new Map<ProductType, number>()
  for (const o of orders) {
    if (!o.isMembership) continue
    counts.set(o.productType, (counts.get(o.productType) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([type, value]) => ({ type, label: PRODUCT_TYPE_LABELS[type], value }))
    .sort((a, b) => b.value - a.value)
}

export interface MonthlyMembersPoint {
  month: string
  label: string
  newMembers: number
  churned: number // estimated
  net: number
  isJanuary: boolean
}

/**
 * New members per month with an ESTIMATED churn line (brief allows estimate).
 * Churn is modeled from the running active base × monthly churn rate, since
 * cancellation events aren't in the order export.
 */
export function monthlyNetMembers(
  orders: Order[],
  monthlyChurnRate: number,
  count = 12,
): MonthlyMembersPoint[] {
  const byMonth = new Map<string, number>()
  for (const o of orders) {
    if (!o.isMembership || o.customerType !== 'new' || o.netSales <= 0) continue
    const month = o.date.slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1)
  }
  const months = [...byMonth.keys()].sort()
  let active = 0
  const points: MonthlyMembersPoint[] = months.map((month) => {
    const added = byMonth.get(month) ?? 0
    const churned = Math.round(active * monthlyChurnRate)
    active = Math.max(0, active + added - churned)
    const [y, m] = month.split('-').map(Number)
    return {
      month,
      label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      }),
      newMembers: added,
      churned,
      net: added - churned,
      isJanuary: m === 1,
    }
  })
  return points.slice(-count)
}

// ── Membership Overview helpers ────────────────────────────────────
const MEMBERSHIP_PLAN_ORDER: ProductType[] = [
  'digital_monthly',
  'digital_yearly',
  'digital_semiannual',
  'digital_quarterly',
  'workbook_monthly',
  'workbook_only',
]

export interface PlanBreakdownRow {
  type: ProductType
  label: string
  members: number
  revenue: number
  mrr: number
}

/** Per-plan members (distinct customers), revenue, and normalized MRR. */
export function planBreakdown(orders: Order[]): PlanBreakdownRow[] {
  return MEMBERSHIP_PLAN_ORDER.map((type) => {
    const os = orders.filter((o) => o.isMembership && o.productType === type && o.netSales > 0)
    return {
      type,
      label: PRODUCT_TYPE_LABELS[type],
      members: new Set(os.map((o) => o.customerName)).size,
      revenue: round(os.reduce((s, o) => s + o.netSales, 0)),
      mrr: round(os.reduce((s, o) => s + (MEMBERSHIP_MONTHLY_VALUE[type] ?? o.netSales), 0)),
    }
  }).filter((r) => r.members > 0 || r.revenue > 0)
}

function monthKey(date: string) {
  return date.slice(0, 7)
}
function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  })
}
function lastMonths(orders: Order[], count: number): string[] {
  const set = new Set(orders.map((o) => monthKey(o.date)))
  return [...set].sort().slice(-count)
}

export interface PlanRevenuePoint {
  month: string
  label: string
  isJanuary: boolean
  values: Record<string, number>
}

/** Monthly revenue split by plan type (for a stacked area chart). */
export function monthlyRevenueByPlan(
  orders: Order[],
  count = 12,
): { points: PlanRevenuePoint[]; plans: { type: ProductType; label: string }[] } {
  const months = lastMonths(orders, count)
  const monthSet = new Set(months)
  const plans = MEMBERSHIP_PLAN_ORDER.map((type) => ({ type, label: PRODUCT_TYPE_LABELS[type] }))
  const points = months.map((month) => {
    const values: Record<string, number> = {}
    plans.forEach((p) => (values[p.type] = 0))
    return { month, label: monthLabel(month), isJanuary: month.endsWith('-01'), values }
  })
  const byMonth = new Map(points.map((p) => [p.month, p]))
  for (const o of orders) {
    if (!o.isMembership || o.netSales <= 0) continue
    const mk = monthKey(o.date)
    if (!monthSet.has(mk)) continue
    const pt = byMonth.get(mk)
    if (pt) pt.values[o.productType] = round((pt.values[o.productType] ?? 0) + o.netSales)
  }
  return { points, plans }
}

export interface PriceSplitPoint {
  month: string
  label: string
  p10: number
  p12: number
}

/** Monthly $10 (grandfathered) vs $12 (current) digital-monthly order counts. */
export function monthlyPriceSplit(orders: Order[], count = 12): PriceSplitPoint[] {
  const months = lastMonths(orders, count)
  const map = new Map<string, PriceSplitPoint>(
    months.map((m) => [m, { month: m, label: monthLabel(m), p10: 0, p12: 0 }]),
  )
  for (const o of orders) {
    if (o.productType !== 'digital_monthly' || o.netSales <= 0) continue
    const pt = map.get(monthKey(o.date))
    if (!pt) continue
    if (Math.round(o.netSales) <= 10) pt.p10++
    else pt.p12++
  }
  return [...map.values()]
}

export interface AcquisitionPoint {
  month: string
  label: string
  newMembers: number
  rolling: number | null
  isJanuary: boolean
}

/** New members per month with a 3-month rolling average. */
export function monthlyAcquisition(orders: Order[], count = 12): AcquisitionPoint[] {
  // compute over a wider window so the rolling average is seeded
  const wide = lastMonths(orders, count + 2)
  const counts = new Map<string, number>(wide.map((m) => [m, 0]))
  for (const o of orders) {
    if (!o.isMembership || o.customerType !== 'new' || o.isFreeTrial || o.netSales <= 0) continue
    const mk = monthKey(o.date)
    if (counts.has(mk)) counts.set(mk, (counts.get(mk) ?? 0) + 1)
  }
  const series = wide.map((m) => ({ month: m, newMembers: counts.get(m) ?? 0 }))
  const points: AcquisitionPoint[] = series.map((s, i) => {
    const window = series.slice(Math.max(0, i - 2), i + 1).map((x) => x.newMembers)
    const rolling = i >= 2 ? Math.round((window.reduce((a, b) => a + b, 0) / window.length) * 10) / 10 : null
    return {
      month: s.month,
      label: monthLabel(s.month),
      newMembers: s.newMembers,
      rolling,
      isJanuary: s.month.endsWith('-01'),
    }
  })
  return points.slice(-count)
}

export interface MemberSplitPoint {
  month: string
  label: string
  newMembers: number
  returningMembers: number
  isJanuary: boolean
}

/** Monthly membership orders split by new vs returning customers (stacked bar). */
export function monthlyMemberSplit(orders: Order[], count = 12): MemberSplitPoint[] {
  const map = new Map<string, MemberSplitPoint>()
  for (const o of orders) {
    if (!o.isMembership || o.netSales <= 0) continue
    const month = o.date.slice(0, 7)
    let pt = map.get(month)
    if (!pt) {
      const [y, m] = month.split('-').map(Number)
      pt = {
        month,
        label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        newMembers: 0,
        returningMembers: 0,
        isJanuary: m === 1,
      }
      map.set(month, pt)
    }
    if (o.customerType === 'returning') pt.returningMembers += 1
    else pt.newMembers += 1
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-count)
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
