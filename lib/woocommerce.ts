import type { CustomerType, Order } from '@/types'
import { buildOrder } from './orders'
import { resolveCredential } from './credentials'
import { kvGet, kvSet } from './credentials-store'

// WooCommerce REST API (wc/v3) — the PRIMARY order source for comefollowmefhe.com.
// Pulls full order history (with emails, line items, coupons) via Basic Auth over
// HTTPS, server-side only. Results are cached in KV for 6h. Google Sheets is the
// backup when this isn't configured or fails (see orders-source.ts).

const WC_VERSION = 'wc/v3'
const PER_PAGE = 100
const MAX_PAGES = 100 // up to ~10k orders within the lookback window
const LOOKBACK_MONTHS = 18
const CACHE_KEY = 'woocommerce:orders:v1'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

function cleanUrl(u: string): string {
  return u.replace(/\/+$/, '').replace(/^http:\/\//, 'https://')
}

function authHeader(v: Record<string, string>): string {
  return 'Basic ' + Buffer.from(`${v.consumerKey}:${v.consumerSecret}`).toString('base64')
}

export async function woocommerceConfigured(): Promise<boolean> {
  const v = await resolveCredential('woocommerce')
  return Boolean(v.storeUrl && v.consumerKey && v.consumerSecret)
}

/** Connection check for the Connections page. */
export async function testWoocommerce(): Promise<{ ok: boolean; status?: number; error?: string; store?: string }> {
  const v = await resolveCredential('woocommerce')
  if (!v.storeUrl || !v.consumerKey || !v.consumerSecret) return { ok: false, error: 'Not configured.' }
  try {
    const res = await fetch(`${cleanUrl(v.storeUrl)}/wp-json/${WC_VERSION}/orders?per_page=1`, {
      headers: { Authorization: authHeader(v), accept: 'application/json' },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, status: res.status, error: `HTTP ${res.status}. ${body.slice(0, 120).replace(/\s+/g, ' ').trim()}` }
    }
    return { ok: true, store: cleanUrl(v.storeUrl) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed.' }
  }
}

interface WcLineItem {
  name?: string
  quantity?: number
  total?: string
  sku?: string
  meta_data?: { key?: string; value?: unknown; display_value?: unknown }[]
}
interface WcOrder {
  id?: number
  number?: string
  status?: string
  date_created?: string
  date_created_gmt?: string
  total?: string
  billing?: { first_name?: string; last_name?: string; email?: string | null }
  line_items?: WcLineItem[]
  coupon_lines?: { code?: string }[]
  meta_data?: { key?: string; value?: unknown }[]
}

function attributionFrom(o: WcOrder): string | null {
  const m = o.meta_data ?? []
  const find = (k: string) => m.find((x) => x.key === k)?.value
  const src = find('_wc_order_attribution_utm_source') ?? find('_wc_order_attribution_source_type')
  return src != null && String(src).trim() ? String(src) : null
}

function mapOrder(o: WcOrder, customerType: CustomerType): Order {
  const items = o.line_items ?? []
  const names = items.map((li) => (li.name ?? '').trim()).filter(Boolean)
  const units = items.reduce((s, li) => s + (Number(li.quantity) || 1), 0)
  // Net sales = sum of line-item totals (post-discount, excludes tax & shipping).
  const net = items.reduce((s, li) => s + (parseFloat(li.total ?? '0') || 0), 0)
  const primary = items[0]
  const hint = [
    primary?.sku ?? '',
    ...(primary?.meta_data ?? []).map((md) => `${md.display_value ?? md.value ?? ''}`),
  ]
    .filter(Boolean)
    .join(' ')
  return buildOrder({
    id: `cfmfhe-${o.id ?? o.number}`,
    source: 'cfmfhe',
    date: new Date(o.date_created_gmt ?? o.date_created ?? '').toISOString().slice(0, 10),
    customerName: [o.billing?.first_name, o.billing?.last_name].filter(Boolean).join(' ') || 'Unknown',
    customerType,
    email: o.billing?.email || null,
    productNames: names.length ? names : ['Unknown product'],
    itemsSold: units || 1,
    netSales: Math.round(net * 100) / 100,
    status: o.status ?? '',
    coupon: o.coupon_lines?.[0]?.code ?? null,
    attribution: attributionFrom(o),
    classifyHint: hint,
  })
}

async function fetchAllRaw(v: Record<string, string>): Promise<WcOrder[]> {
  const base = `${cleanUrl(v.storeUrl)}/wp-json/${WC_VERSION}/orders`
  const since = new Date()
  since.setMonth(since.getMonth() - LOOKBACK_MONTHS)
  const after = since.toISOString()
  const all: WcOrder[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `${base}?per_page=${PER_PAGE}&page=${page}&after=${encodeURIComponent(after)}` +
      `&orderby=date&order=asc&status=any`
    const res = await fetch(url, { headers: { Authorization: authHeader(v), accept: 'application/json' } })
    if (!res.ok) {
      if (page === 1) throw new Error(`HTTP ${res.status}`)
      break // partial data is better than none
    }
    const batch = (await res.json()) as WcOrder[]
    if (!Array.isArray(batch) || batch.length === 0) break
    all.push(...batch)
    if (batch.length < PER_PAGE) break
  }
  return all
}

async function readCache(): Promise<{ orders: Order[]; cachedAt: number } | null> {
  try {
    const raw = await kvGet(CACHE_KEY)
    return raw ? (JSON.parse(raw) as { orders: Order[]; cachedAt: number }) : null
  } catch {
    return null
  }
}

/**
 * Live WooCommerce orders. configured=false when not set up; never throws.
 * Derives per-order new vs returning from email (or name) first-seen within the
 * window; business-wide identity matching across stores is handled separately.
 */
export async function getWooOrders(): Promise<{ configured: boolean; orders: Order[]; error?: string }> {
  const v = await resolveCredential('woocommerce')
  if (!v.storeUrl || !v.consumerKey || !v.consumerSecret) return { configured: false, orders: [] }

  const cached = await readCache()
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { configured: true, orders: cached.orders }
  }

  try {
    const raw = await fetchAllRaw(v) // chronological (order=asc)
    const seen = new Set<string>()
    const orders = raw.map((o) => {
      const email = o.billing?.email?.toLowerCase().trim()
      const name = [o.billing?.first_name, o.billing?.last_name].filter(Boolean).join(' ').toLowerCase().trim()
      const key = email || (name ? `name:${name}` : '')
      let ct: CustomerType = 'unknown'
      if (key) {
        ct = seen.has(key) ? 'returning' : 'new'
        seen.add(key)
      }
      return mapOrder(o, ct)
    })
    await kvSet(CACHE_KEY, JSON.stringify({ orders, cachedAt: Date.now() })).catch(() => {})
    return { configured: true, orders }
  } catch (e) {
    return { configured: true, orders: cached?.orders ?? [], error: e instanceof Error ? e.message : 'Request failed.' }
  }
}
