import type { CustomerType, Order } from '@/types'
import { buildOrder } from './orders'
import { resolveCredential } from './credentials'
import { kvGet, kvSet } from './credentials-store'

const API_VERSION = '2026-01'
const MAX_PAGES = 6 // up to ~1,500 recent orders
const LOOKBACK_MONTHS = 18

function cleanDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function baseUrl(domain: string): string {
  return `https://${cleanDomain(domain)}/admin/api/${API_VERSION}`
}

/**
 * Resolve a usable Admin API access token. Legacy custom apps provide a static
 * token (accessToken). Apps created in the Shopify Dev Dashboard (Jan 2026+)
 * provide a Client ID + Secret and require the client-credentials grant to mint
 * a short-lived (~24h) token — we fetch and cache it in KV until it nears expiry.
 */
export async function getShopifyToken(v: Record<string, string>): Promise<string> {
  if (v.accessToken) return v.accessToken // legacy static token
  if (!v.storeDomain || !v.clientId || !v.clientSecret) {
    throw new Error('Shopify not configured (need a token, or Client ID + Secret).')
  }
  const domain = cleanDomain(v.storeDomain)
  const cacheKey = `shopify:token:${domain}:${v.clientId}`

  try {
    const raw = await kvGet(cacheKey)
    if (raw) {
      const c = JSON.parse(raw) as { token: string; expiresAt: number }
      if (c.token && c.expiresAt > Date.now()) return c.token
    }
  } catch {
    /* ignore cache miss */
  }

  // Client credentials grant — MUST be form-encoded, not JSON.
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      client_id: v.clientId,
      client_secret: v.clientSecret,
      grant_type: 'client_credentials',
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`token grant ${res.status}. ${body.slice(0, 120).replace(/\s+/g, ' ').trim()}`)
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!json.access_token) throw new Error('token grant returned no access_token')
  const ttl = (json.expires_in ?? 86400) - 300 // refresh 5 min early
  await kvSet(cacheKey, JSON.stringify({ token: json.access_token, expiresAt: Date.now() + ttl * 1000 })).catch(() => {})
  return json.access_token
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
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      const detail = body.slice(0, 140).replace(/\s+/g, ' ').trim()
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          status: res.status,
          error: `Token rejected (${res.status}). ${detail || 'Check the token, that the app is installed, and that protected customer data access is granted.'}`,
        }
      }
      return { ok: false, status: res.status, error: `Shopify returned ${res.status}. ${detail}`.trim() }
    }
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
  const hasAuth = v.accessToken || (v.clientId && v.clientSecret)
  if (!v.storeDomain || !hasAuth) return { configured: false, orders: [] }

  let token: string
  try {
    token = await getShopifyToken(v)
  } catch (e) {
    return { configured: true, orders: [], error: e instanceof Error ? e.message : 'Auth failed.' }
  }

  const since = new Date()
  since.setMonth(since.getMonth() - LOOKBACK_MONTHS)
  let url: string | null =
    `${baseUrl(v.storeDomain)}/orders.json?status=any&limit=250&created_at_min=${since.toISOString()}`

  const orders: Order[] = []
  try {
    for (let page = 0; page < MAX_PAGES && url; page++) {
      const res: Response = await shopifyFetch(url, token)
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
