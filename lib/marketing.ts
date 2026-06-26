import type { Order } from '@/types'
import { totalRevenue } from './metrics'
import { businessNewVsReturning } from './identity'

// CMO assumptions, stored via settings-store under key "cmo".
export interface CogsOverride {
  name: string
  pct: number // 0..1
}
export interface MonthlyAdSpend {
  month: string // YYYY-MM
  amount: number
}
export interface CmoSettings {
  cogsDefaultPct: number // 0..1
  cogsOverrides: CogsOverride[]
  shippingPerOrder: number // flat $ estimate per order
  manualAdSpend: MonthlyAdSpend[]
}

export const DEFAULT_CMO_SETTINGS: CmoSettings = {
  cogsDefaultPct: 0.35,
  cogsOverrides: [],
  shippingPerOrder: 0,
  manualAdSpend: [],
}

/** Manual ad spend whose month falls within the selected window. */
export function adSpendForRange(settings: CmoSettings, from: string, to: string): number {
  const fromM = from.slice(0, 7)
  const toM = to.slice(0, 7)
  return settings.manualAdSpend
    .filter((m) => m.month >= fromM && m.month <= toM)
    .reduce((s, m) => s + (Number(m.amount) || 0), 0)
}

/** Modeled cost of goods sold: per-product override % when set, else default. */
export function totalCogs(orders: Order[], settings: CmoSettings): number {
  const ov = new Map(settings.cogsOverrides.map((o) => [o.name.trim().toLowerCase(), o.pct]))
  return orders.reduce((s, o) => {
    if (o.netSales <= 0) return s
    const pct = ov.get((o.productNames[0] ?? '').trim().toLowerCase()) ?? settings.cogsDefaultPct
    return s + o.netSales * pct
  }, 0)
}

export interface CmoMetrics {
  revenue: number
  adSpend: number
  cogs: number
  shipping: number
  contributionMargin: number
  contributionMarginPct: number
  roas: number | null
  ncRoas: number | null
  cac: number | null
  newCustomers: number
  returningCustomers: number
  newRevenue: number
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * @param periodOrders orders within the selected window (paid + unpaid filtered)
 * @param allOrders all-time orders (for identity / new-vs-returning)
 */
export function computeCmo(
  periodOrders: Order[],
  allOrders: Order[],
  from: string,
  to: string,
  settings: CmoSettings,
): CmoMetrics {
  const revenue = totalRevenue(periodOrders)
  const adSpend = adSpendForRange(settings, from, to)
  const cogs = totalCogs(periodOrders, settings)
  const orderCount = periodOrders.filter((o) => o.netSales > 0).length
  const shipping = orderCount * settings.shippingPerOrder
  const contributionMargin = revenue - cogs - shipping - adSpend
  const nvr = businessNewVsReturning(allOrders, from, to)
  return {
    revenue: round(revenue),
    adSpend: round(adSpend),
    cogs: round(cogs),
    shipping: round(shipping),
    contributionMargin: round(contributionMargin),
    contributionMarginPct: revenue ? contributionMargin / revenue : 0,
    roas: adSpend > 0 ? revenue / adSpend : null,
    ncRoas: adSpend > 0 ? nvr.newRevenue / adSpend : null,
    cac: adSpend > 0 && nvr.newCustomers > 0 ? adSpend / nvr.newCustomers : null,
    newCustomers: nvr.newCustomers,
    returningCustomers: nvr.returningCustomers,
    newRevenue: round(nvr.newRevenue),
  }
}
