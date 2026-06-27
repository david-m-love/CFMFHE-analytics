import type { DataEnvelope, SourceStatus } from '@/types'
import { resolveCredential } from './credentials'
import { kvGet, kvSet } from './credentials-store'

// Klaviyo subscriber growth. Totals come from list profile_count (fetched
// SEQUENTIALLY — Klaviyo limits profile_count to ~1 req/sec). New subscribers
// come from each list's joined_group_at (real join dates). The whole result is
// cached in KV for 6h so page loads are fast and never re-trip rate limits.

const BASE = 'https://a.klaviyo.com/api'
const REVISION = '2024-10-15'
const MAX_LIST_COUNTS = 10 // lists to fetch profile_count for (sequential)
const COUNT_DELAY_MS = 850 // spacing to respect the 1 req/sec profile_count limit
const MAX_JOIN_PAGES = 12 // page cap per list for joined_group_at
const CACHE_KEY = 'klaviyo:overview-v3'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

export interface ListCount {
  name: string
  count: number
}
export interface SubscriberMonth {
  month: string
  label: string
  email: number
  sms: number
}
interface CoreData {
  emailSubscribers: number
  smsSubscribers: number
  monthly: SubscriberMonth[]
  lists: ListCount[]
  capped: boolean
}
export interface KlaviyoOverview extends CoreData {
  newEmail: number
  newSms: number
  emailGrowthPct: number
  newPerMonthAvg: number
}

const round = (n: number) => Math.round(n * 100) / 100
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'failed')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function headers(apiKey: string) {
  return { Authorization: `Klaviyo-API-Key ${apiKey}`, revision: REVISION, accept: 'application/json' }
}

function monthBuckets(): SubscriberMonth[] {
  const now = new Date()
  const out: SubscriberMonth[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    out.push({
      month: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      email: 0,
      sms: 0,
    })
  }
  return out
}

const isSms = (name: string) => /sms|text message|phone/i.test(name)

export async function getKlaviyoOverview(
  from: string,
  to: string,
): Promise<DataEnvelope<KlaviyoOverview>> {
  const v = await resolveCredential('klaviyo')
  if (!v.apiKey) {
    return { status: 'mock' as SourceStatus, updatedAt: null, data: derive(sampleCore(), from, to), note: 'Showing sample subscriber data — connect Klaviyo for live numbers.' }
  }

  // Serve from cache when fresh.
  const cached = await readCache()
  if (cached) {
    return { status: 'connected', updatedAt: new Date(cached.cachedAt).toISOString(), data: derive(cached.core, from, to) }
  }

  try {
    const core = await computeCore(v.apiKey)
    await writeCache(core)
    return { status: 'connected', updatedAt: new Date().toISOString(), data: derive(core, from, to) }
  } catch (e) {
    return {
      status: 'disconnected',
      updatedAt: null,
      data: derive(sampleCore(), from, to),
      note: `Klaviyo request failed (${errMsg(e)}) — showing sample data. A 401/403 usually means the API key lacks List/Profiles read access.`,
    }
  }
}

/** Compute range-dependent figures from the cached/computed 12-month core. */
function derive(core: CoreData, from: string, to: string): KlaviyoOverview {
  const fromM = from.slice(0, 7)
  const toM = to.slice(0, 7)
  const inRange = core.monthly.filter((m) => m.month >= fromM && m.month <= toM)
  const newEmail = inRange.reduce((s, m) => s + m.email, 0)
  const newSms = inRange.reduce((s, m) => s + m.sms, 0)
  const newPerMonthAvg = Math.round(core.monthly.reduce((s, m) => s + m.email + m.sms, 0) / core.monthly.length)
  const priorEmail = core.emailSubscribers - newEmail
  const emailGrowthPct = core.emailSubscribers > 0 && priorEmail > 0 ? round(newEmail / priorEmail) : 0
  return { ...core, newEmail, newSms, emailGrowthPct, newPerMonthAvg }
}

async function computeCore(apiKey: string): Promise<CoreData> {
  // 1) Enumerate lists, then fetch profile_count sequentially (rate-limit safe).
  const res = await fetch(`${BASE}/lists/`, { headers: headers(apiKey) })
  if (!res.ok) throw new Error(`lists ${res.status}`)
  const json = (await res.json()) as { data?: { id?: string; attributes?: { name?: string } }[] }
  const base = (json.data ?? []).map((l) => ({ id: l.id ?? '', name: l.attributes?.name ?? 'List' }))

  const counted: { id: string; name: string; count: number }[] = []
  for (const l of base.slice(0, MAX_LIST_COUNTS)) {
    let count = 0
    if (l.id) {
      try {
        const r = await fetch(`${BASE}/lists/${l.id}/?additional-fields[list]=profile_count`, { headers: headers(apiKey) })
        if (r.ok) {
          const j = (await r.json()) as { data?: { attributes?: { profile_count?: number } } }
          count = j.data?.attributes?.profile_count ?? 0
        }
      } catch {
        /* tolerate */
      }
      await sleep(COUNT_DELAY_MS)
    }
    counted.push({ ...l, count })
  }

  // 2) Identify the primary email + SMS lists (largest of each kind).
  const sorted = [...counted].sort((a, b) => b.count - a.count)
  const emailList = sorted.find((l) => !isSms(l.name))
  const smsList = sorted.find((l) => isSms(l.name))

  // 3) New subscribers per month from each list's join dates (parallel; profiles:read is 75/s).
  const monthly = monthBuckets()
  const byMonth = new Map(monthly.map((m) => [m.month, m]))
  const firstMonth = monthly[0].month
  const [eCap, sCap] = await Promise.all([
    emailList ? fetchJoinsByMonth(apiKey, emailList.id, 'email', byMonth, firstMonth) : Promise.resolve(false),
    smsList ? fetchJoinsByMonth(apiKey, smsList.id, 'sms', byMonth, firstMonth) : Promise.resolve(false),
  ])

  return {
    emailSubscribers: emailList?.count ?? 0,
    smsSubscribers: smsList?.count ?? 0,
    monthly,
    lists: counted.map(({ name, count }) => ({ name, count })).sort((a, b) => b.count - a.count),
    capped: eCap || sCap,
  }
}

/** Page a list's profiles by join date, bucketing into the 12-month window. */
async function fetchJoinsByMonth(
  apiKey: string,
  listId: string,
  channel: 'email' | 'sms',
  byMonth: Map<string, SubscriberMonth>,
  firstMonth: string,
): Promise<boolean> {
  const earliest = `${firstMonth}-01T00:00:00Z`
  let url: string | null =
    `${BASE}/lists/${listId}/profiles/?sort=-joined_group_at` +
    `&filter=${encodeURIComponent(`greater-or-equal(joined_group_at,${earliest})`)}` +
    `&fields[profile]=joined_group_at&page[size]=100`
  let pages = 0
  let capped = false
  let reachedOld = false

  while (url && pages < MAX_JOIN_PAGES && !reachedOld) {
    const res: Response = await fetch(url, { headers: headers(apiKey) })
    if (!res.ok) break
    const json = (await res.json()) as {
      data?: { attributes?: { joined_group_at?: string } }[]
      links?: { next?: string | null }
    }
    for (const p of json.data ?? []) {
      const j = p.attributes?.joined_group_at
      if (!j) continue
      const mk = j.slice(0, 7)
      if (mk < firstMonth) {
        reachedOld = true
        break
      }
      const bucket = byMonth.get(mk)
      if (bucket) bucket[channel] += 1
    }
    url = json.links?.next ?? null
    pages++
    if (url && pages >= MAX_JOIN_PAGES && !reachedOld) capped = true
  }
  return capped
}

// ── Cache ────────────────────────────────────────────────────────────────
async function readCache(): Promise<{ core: CoreData; cachedAt: number } | null> {
  try {
    const raw = await kvGet(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { core: CoreData; cachedAt: number }
    if (!parsed?.cachedAt || Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}
async function writeCache(core: CoreData): Promise<void> {
  try {
    await kvSet(CACHE_KEY, JSON.stringify({ core, cachedAt: Date.now() }))
  } catch {
    /* cache is best-effort */
  }
}

// ── Sample fallback ──────────────────────────────────────────────────────
function sampleCore(): CoreData {
  const monthly = monthBuckets().map((m, i) => {
    const email = m.month.endsWith('-01') ? 210 : 95 + i * 7
    return { ...m, email, sms: Math.round(email * 0.22) }
  })
  return {
    emailSubscribers: 33803,
    smsSubscribers: 8998,
    monthly,
    lists: [
      { name: 'Newsletter', count: 33803 },
      { name: 'SMS Subscribers', count: 8998 },
      { name: 'Essential Conversations Shopify', count: 7982 },
    ],
    capped: false,
  }
}
