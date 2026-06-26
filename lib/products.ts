import type { Order, ProductType } from '@/types'
import { PRODUCT_TYPE_LABELS } from '@/types'

// Product-level aggregation. NOTE: netSales is order-level, so revenue is
// attributed to each order's PRIMARY product (productNames[0]); units use
// itemsSold. Good enough for ranking/sales; refine later with line-item prices.

// Memberships consolidate under their canonical type label so the same plan
// under different historical names (e.g. "Digital Membership - Monthly" and
// "Digital Subscription - Monthly") rolls up into one line. Non-membership
// products keep their own product name.
function primaryName(o: Order): string {
  if (o.isMembership) return PRODUCT_TYPE_LABELS[o.productType]
  return o.productNames[0]?.trim() || 'Unknown product'
}

export interface ProductRow {
  name: string
  productType: ProductType
  units: number
  revenue: number
  orders: number
  avgPrice: number
}

export function productAggregates(orders: Order[]): ProductRow[] {
  const map = new Map<string, ProductRow>()
  for (const o of orders) {
    if (o.netSales <= 0) continue
    const name = primaryName(o)
    const row =
      map.get(name) ??
      { name, productType: o.productType, units: 0, revenue: 0, orders: 0, avgPrice: 0 }
    row.units += o.itemsSold || 1
    row.revenue += o.netSales
    row.orders += 1
    map.set(name, row)
  }
  const rows = [...map.values()]
  rows.forEach((r) => {
    r.revenue = Math.round(r.revenue * 100) / 100
    r.avgPrice = r.units ? Math.round((r.revenue / r.units) * 100) / 100 : 0
  })
  return rows.sort((a, b) => b.revenue - a.revenue)
}

export interface CategoryRow {
  type: ProductType
  label: string
  revenue: number
  units: number
  orders: number
}

export function categoryAggregates(orders: Order[]): CategoryRow[] {
  const map = new Map<ProductType, CategoryRow>()
  for (const o of orders) {
    if (o.netSales <= 0) continue
    const row =
      map.get(o.productType) ??
      { type: o.productType, label: PRODUCT_TYPE_LABELS[o.productType], revenue: 0, units: 0, orders: 0 }
    row.revenue += o.netSales
    row.units += o.itemsSold || 1
    row.orders += 1
    map.set(o.productType, row)
  }
  return [...map.values()]
    .map((r) => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
}

export function distinctProductNames(orders: Order[]): string[] {
  return [...new Set(orders.filter((o) => o.netSales > 0).map(primaryName))].sort()
}

export interface ProductTrendPoint {
  month: string
  label: string
  values: Record<string, number>
}

/** Monthly revenue for a chosen set of products (for the comparison trend). */
export function monthlyRevenueForProducts(
  orders: Order[],
  names: string[],
  count = 12,
): ProductTrendPoint[] {
  const want = new Set(names)
  const months = [...new Set(orders.map((o) => o.date.slice(0, 7)))].sort().slice(-count)
  const monthSet = new Set(months)
  const points: ProductTrendPoint[] = months.map((m) => {
    const [y, mo] = m.split('-').map(Number)
    const values: Record<string, number> = {}
    names.forEach((n) => (values[n] = 0))
    return {
      month: m,
      label: new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      values,
    }
  })
  const byMonth = new Map(points.map((p) => [p.month, p]))
  for (const o of orders) {
    if (o.netSales <= 0) continue
    const name = primaryName(o)
    if (!want.has(name)) continue
    const mk = o.date.slice(0, 7)
    if (!monthSet.has(mk)) continue
    const pt = byMonth.get(mk)
    if (pt) pt.values[name] = Math.round((pt.values[name] + o.netSales) * 100) / 100
  }
  return points
}
