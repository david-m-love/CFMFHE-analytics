import type { CustomerType, Order } from '@/types'
import { buildOrder } from './orders'
import { resolveCredential } from './credentials'
import { kvGet, kvSet } from './credentials-store'

const API_VERSION = '2026-01'
const MAX_PAGES = 6 // REST fallback: up to ~1,500 recent orders
const LOOKBACK_MONTHS = 18

// Bulk-operation pipeline: orders are cached in KV and refreshed via a GraphQL
// bulk query (one async job → full history, near-free against the cost bucket).
const ORDERS_CACHE_KEY = 'shopify:orders:v1'
const ORDERS_TTL_MS = 6 * 60 * 60 * 1000
const BULK_POLL_BUDGET_MS = 45_000 // bounded wait so a page request never hangs
const BULK_POLL_INTERVAL_MS = 2_500

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

/** REST fallback: paginated order fetch (used if the bulk pipeline errors). */
async function fetchOrdersRest(domain: string, token: string): Promise<Order[]> {
  const since = new Date()
  since.setMonth(since.getMonth() - LOOKBACK_MONTHS)
  let url: string | null =
    `${baseUrl(domain)}/orders.json?status=any&limit=250&created_at_min=${since.toISOString()}`
  const orders: Order[] = []
  for (let page = 0; page < MAX_PAGES && url; page++) {
    const res: Response = await shopifyFetch(url, token)
    if (!res.ok) {
      if (page === 0) throw new Error(`Shopify returned ${res.status}.`)
      break
    }
    const json = (await res.json()) as { orders?: ShopifyOrder[] }
    for (const o of json.orders ?? []) orders.push(normalize(o))
    url = nextPageUrl(res.headers.get('link'))
  }
  return orders
}

// ── GraphQL bulk pipeline ──────────────────────────────────────────────────
async function shopifyGraphQL(domain: string, token: string, query: string): Promise<unknown> {
  const res = await fetch(`${baseUrl(domain)}/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': token,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`GraphQL ${res.status}`)
  const json = (await res.json()) as { data?: unknown; errors?: { message?: string }[] }
  if (json.errors?.length) throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join('; ').slice(0, 140)}`)
  return json.data
}

function bulkOrdersQuery(): string {
  const since = new Date()
  since.setMonth(since.getMonth() - LOOKBACK_MONTHS)
  const sinceDate = since.toISOString().slice(0, 10)
  return `mutation {
    bulkOperationRunQuery(query: """
      {
        orders(query: "created_at:>=${sinceDate}") {
          edges { node {
            id name createdAt displayFinancialStatus email
            subtotalPriceSet { shopMoney { amount } }
            discountCodes
            sourceName
            customer { firstName lastName numberOfOrders }
            lineItems { edges { node { title quantity } } }
          } }
        }
      }
    """) {
      bulkOperation { id status }
      userErrors { field message }
    }
  }`
}

interface BulkStatus {
  status?: string
  url?: string | null
  errorCode?: string | null
}

async function currentBulkOp(domain: string, token: string): Promise<BulkStatus> {
  const data = (await shopifyGraphQL(
    domain,
    token,
    `{ currentBulkOperation(type: QUERY) { id status errorCode url objectCount } }`,
  )) as { currentBulkOperation?: BulkStatus | null }
  return data.currentBulkOperation ?? {}
}

/** Start (or reuse) a bulk orders query, wait up to the budget, return its result URL. */
async function runBulkOrders(domain: string, token: string): Promise<string> {
  let cur = await currentBulkOp(domain, token)
  // If nothing is running, kick off a fresh query.
  if (cur.status !== 'RUNNING' && cur.status !== 'CREATED') {
    const data = (await shopifyGraphQL(domain, token, bulkOrdersQuery())) as {
      bulkOperationRunQuery?: { bulkOperation?: BulkStatus; userErrors?: { message?: string }[] }
    }
    const errs = data.bulkOperationRunQuery?.userErrors ?? []
    // "already in progress" is fine — we'll just poll the running one.
    if (errs.length && !/already in progress/i.test(errs.map((e) => e.message).join(' '))) {
      throw new Error(`bulk start: ${errs.map((e) => e.message).join('; ').slice(0, 140)}`)
    }
    cur = data.bulkOperationRunQuery?.bulkOperation ?? (await currentBulkOp(domain, token))
  }

  const deadline = Date.now() + BULK_POLL_BUDGET_MS
  while (Date.now() < deadline) {
    if (cur.status === 'COMPLETED' && cur.url) return cur.url
    if (cur.status === 'FAILED' || cur.status === 'CANCELED') {
      throw new Error(`bulk ${cur.status?.toLowerCase()}${cur.errorCode ? ` (${cur.errorCode})` : ''}`)
    }
    await new Promise((r) => setTimeout(r, BULK_POLL_INTERVAL_MS))
    cur = await currentBulkOp(domain, token)
  }
  if (cur.status === 'COMPLETED' && cur.url) return cur.url
  throw new Error('bulk-in-progress') // still running — caller serves cache and retries later
}

interface GqlOrderNode {
  id?: string
  name?: string
  createdAt?: string
  displayFinancialStatus?: string
  email?: string | null
  subtotalPriceSet?: { shopMoney?: { amount?: string } }
  discountCodes?: string[]
  sourceName?: string | null
  customer?: { firstName?: string; lastName?: string; numberOfOrders?: string } | null
}

/** Parse the JSONL bulk result: orders + their line-item child lines (by __parentId). */
async function parseBulkJsonl(url: string): Promise<Order[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`bulk download ${res.status}`)
  const text = await res.text()
  const orderNodes = new Map<string, GqlOrderNode>()
  const lineItems = new Map<string, { title: string; quantity: number }[]>()

  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let obj: Record<string, unknown>
    try {
      obj = JSON.parse(line)
    } catch {
      continue
    }
    const id = obj.id as string | undefined
    const parentId = obj.__parentId as string | undefined
    if (parentId && id?.includes('/LineItem/')) {
      const arr = lineItems.get(parentId) ?? []
      arr.push({ title: (obj.title as string) ?? '', quantity: Number(obj.quantity) || 1 })
      lineItems.set(parentId, arr)
    } else if (id?.includes('/Order/')) {
      orderNodes.set(id, obj as GqlOrderNode)
    }
  }

  const orders: Order[] = []
  for (const [gid, o] of orderNodes) {
    const items = lineItems.get(gid) ?? []
    const names = items.map((li) => li.title).filter(Boolean)
    const units = items.reduce((s, li) => s + (li.quantity || 1), 0)
    const num = parseInt(o.customer?.numberOfOrders ?? '', 10)
    const customerType: CustomerType = isFinite(num) ? (num > 1 ? 'returning' : 'new') : 'unknown'
    orders.push(
      buildOrder({
        id: `ec-${gid.split('/').pop()}`,
        source: 'ec',
        date: new Date(o.createdAt ?? '').toISOString().slice(0, 10),
        customerName: [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || 'Unknown',
        customerType,
        email: o.email ?? null,
        productNames: names,
        itemsSold: units || 1,
        netSales: parseFloat(o.subtotalPriceSet?.shopMoney?.amount ?? '0') || 0,
        status: o.displayFinancialStatus ?? '',
        coupon: o.discountCodes?.[0] ?? null,
        attribution: o.sourceName ?? null,
      }),
    )
  }
  return orders
}

// ── Cache ────────────────────────────────────────────────────────────────
async function readOrdersCache(): Promise<{ orders: Order[]; cachedAt: number } | null> {
  try {
    const raw = await kvGet(ORDERS_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as { orders: Order[]; cachedAt: number }
  } catch {
    return null
  }
}
async function writeOrdersCache(orders: Order[]): Promise<void> {
  await kvSet(ORDERS_CACHE_KEY, JSON.stringify({ orders, cachedAt: Date.now() })).catch(() => {})
}

/**
 * Live EC orders from Shopify. Serves a 6h KV cache; refreshes via the GraphQL
 * bulk pipeline (full history), falling back to REST pagination if bulk errors.
 * configured=false when not set up; never throws.
 */
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

  const cached = await readOrdersCache()
  if (cached && Date.now() - cached.cachedAt < ORDERS_TTL_MS) {
    return { configured: true, orders: cached.orders }
  }

  const domain = cleanDomain(v.storeDomain)

  // Preferred path: GraphQL bulk operation → full history.
  try {
    const url = await runBulkOrders(domain, token)
    const orders = await parseBulkJsonl(url)
    await writeOrdersCache(orders)
    return { configured: true, orders }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'bulk failed'
    // Bulk still running: serve stale cache (or empty) and let the next load ingest.
    if (msg === 'bulk-in-progress') {
      return { configured: true, orders: cached?.orders ?? [], error: cached ? undefined : 'Importing orders… check back shortly.' }
    }
    // Bulk errored: fall back to REST pagination so data still flows.
    try {
      const orders = await fetchOrdersRest(domain, token)
      await writeOrdersCache(orders)
      return { configured: true, orders }
    } catch (e2) {
      return {
        configured: true,
        orders: cached?.orders ?? [],
        error: cached ? undefined : (e2 instanceof Error ? e2.message : 'Request failed.'),
      }
    }
  }
}
