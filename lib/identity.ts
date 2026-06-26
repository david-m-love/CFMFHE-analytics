import type { Order } from '@/types'

// Cross-store customer identity. Matches the same person across Shopify and
// WooCommerce so "new vs returning" is accurate business-wide: a buyer who is
// new to one store but already a customer of the other is counted as RETURNING.
//
// Matching key: email when present (Shopify has it), otherwise normalized name.
// NOTE: WooCommerce order exports lack email, so cfmfhe customers match on name
// for now — accurate matching improves once a WooCommerce API connector adds
// emails (see plan).

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function customerKey(o: Order): string {
  const email = o.email?.trim().toLowerCase()
  return email && email.includes('@') ? `email:${email}` : `name:${normName(o.customerName)}`
}

/** Earliest paid-order date per unified customer, across ALL stores/time. */
export function firstPurchaseDates(allOrders: Order[]): Map<string, string> {
  const first = new Map<string, string>()
  for (const o of allOrders) {
    if (o.netSales <= 0) continue
    const k = customerKey(o)
    const cur = first.get(k)
    if (!cur || o.date < cur) first.set(k, o.date)
  }
  return first
}

export interface NewVsReturning {
  newCustomers: number
  returningCustomers: number
  newRevenue: number
  returningRevenue: number
}

/**
 * Business-wide new vs returning over [from, to]. A customer is "new" if their
 * first-ever purchase (any store) falls inside the window; otherwise returning.
 * Pass ALL-TIME orders so first-purchase dates are correct.
 */
export function businessNewVsReturning(allOrders: Order[], from: string, to: string): NewVsReturning {
  const first = firstPurchaseDates(allOrders)
  const newC = new Set<string>()
  const retC = new Set<string>()
  let newRev = 0
  let retRev = 0
  for (const o of allOrders) {
    if (o.netSales <= 0 || o.date < from || o.date > to) continue
    const k = customerKey(o)
    const fd = first.get(k)!
    if (fd >= from && fd <= to) {
      newC.add(k)
      newRev += o.netSales
    } else {
      retC.add(k)
      retRev += o.netSales
    }
  }
  return {
    newCustomers: newC.size,
    returningCustomers: retC.size,
    newRevenue: Math.round(newRev * 100) / 100,
    returningRevenue: Math.round(retRev * 100) / 100,
  }
}
