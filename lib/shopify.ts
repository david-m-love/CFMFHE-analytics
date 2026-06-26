import type { CustomerType, Order } from '@/types'
import { buildOrder } from './orders'
import { resolveCredential } from './credentials'

const API_VERSION = '2026-01'
const MAX_PAGES = 6 // up to ~1,500 recent orders
const LOOKBACK_MONTHS = 18

function baseUrl(domain: string): string {
  const clean = domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return `https://${clean}/admin/api/${API_VERSION}`
}

async function shopifyFetch(url: string, token: string, timeoutMs = 9000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token, accept: 'application/json' },
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

/** Connection test — returns the shop name on success. */
export async function testShopify(
  domain: string,
  token: string,
): Promise<{ ok: boolean; name?: string; status?: number; error?: string }> {
  try {
    const res = await shopifyFetch(`${baseUrl(domain)}/shop.json`, token)
    if (res.status === 401 || res.status === 403) return { ok: false, status: res.status, error: 'Access token rejected.' }
    if (!res.ok) return { ok: false, status: res.status, error: `Shopify returned ${res.status}.` }
    const json = (await res.json()) as { shop?: { name?: string } }
    return { ok: true, name: json.shop?.name }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed.' }
  }
}

interface ShopifyOrder {
  id: number
  name?: string
  created_at: string
  financial_status?: string
  email?: string | null
  subtotal_price?: string
  total_price?: string
  discount_codes?: { code?: string }[]
  source_name?: string | null
  customer?: { first_name?: string; last_name?: string; orders_count?: number } | null
  line_items?: { title?: string; quantity?: number }[]
}

function nextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  // format: <https://…page_info=…>; rel="next", <…>; rel="previous"
  for (const part of linkHeader.split(',')) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/)
    if (m) return m[1]
  }
  return null
}

function normalize(o: ShopifyOrder): Order {
  const names = (o.line_items ?? []).map((li) => li.title ?? '').filter(Boolean)
  const items = (o.line_items ?? []).reduce((s, li) => s + (li.quantity ?? 1), 0)
  const net = parseFloat(o.subtotal_price ?? o.total_price ?? '0') || 0
  const customerType: CustomerType =
    o.customer?.orders_count != null ? (o.customer.orders_count > 1 ? 'returning' : 'new') : 'unknown'
  const name =
    [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(' ') || 'Unknown'
  return buildOrder({
    id: `ec-${o.id}`,
    source: 'ec',
    date: new Date(o.created_at).toISOString().slice(0, 10),
    customerName: name,
    customerType,
    email: o.email ?? null,
    productNames: names,
    itemsSold: items || 1,
    netSales: net,
    status: o.financial_status ?? '',
    coupon: o.discount_codes?.[0]?.code ?? null,
    attribution: o.source_name ?? null,
  })
}

/** Live EC orders from Shopify. configured=false when not set up. */
export async function getEcOrders(): Promise<{ configured: boolean; orders: Order[]; error?: string }> {
  const v = await resolveCredential('shopify')
  if (!v.storeDomain || !v.accessToken) return { configured: false, orders: [] }

  const since = new Date()
  since.setMonth(since.getMonth() - LOOKBACK_MONTHS)
  let url: string | null =
    `${baseUrl(v.storeDomain)}/orders.json?status=any&limit=250&created_at_min=${since.toISOString()}`

  const orders: Order[] = []
  try {
    for (let page = 0; page < MAX_PAGES && url; page++) {
      const res: Response = await shopifyFetch(url, v.accessToken)
      if (!res.ok) {
        if (page === 0) return { configured: true, orders: [], error: `Shopify returned ${res.status}.` }
        break
      }
      const json = (await res.json()) as { orders?: ShopifyOrder[] }
      for (const o of json.orders ?? []) orders.push(normalize(o))
      url = nextPageUrl(res.headers.get('link'))
    }
    return { configured: true, orders }
  } catch (e) {
    return { configured: true, orders: [], error: e instanceof Error ? e.message : 'Request failed.' }
  }
}
