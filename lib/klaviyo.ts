import type { DataEnvelope, SourceStatus } from '@/types'
import { resolveCredential } from './credentials'

// Klaviyo subscriber growth. Real data when the API key is set, otherwise
// deterministic sample data so the Email & SMS dashboard always renders.

const BASE = 'https://a.klaviyo.com/api'
const REVISION = '2024-10-15'
const MAX_PROFILE_PAGES = 30 // cap paging at ~3,000 most-recent profiles

export interface ListCount {
  name: string
  count: number
}
export interface SubscriberMonth {
  month: string // YYYY-MM
  label: string
  count: number
}
export interface KlaviyoOverview {
  totalContacts: number
  newContacts: number // created within [from, to]
  newPerMonthAvg: number
  growthRatePct: number // newContacts ÷ prior total
  monthly: SubscriberMonth[] // last 12 months of new contacts
  lists: ListCount[]
  capped: boolean // true if profile paging hit the cap (so newContacts undercounts)
}

const round = (n: number) => Math.round(n * 100) / 100

function headers(apiKey: string) {
  return {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: REVISION,
    accept: 'application/json',
  }
}

function isoNoMs(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** Build the trailing-12-month buckets ending at the current month. */
function monthBuckets(): SubscriberMonth[] {
  const now = new Date()
  const out: SubscriberMonth[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    out.push({
      month: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      count: 0,
    })
  }
  return out
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'failed')

export async function getKlaviyoOverview(
  from: string,
  to: string,
): Promise<DataEnvelope<KlaviyoOverview>> {
  const v = await resolveCredential('klaviyo')
  if (!v.apiKey) {
    return {
      status: 'mock' as SourceStatus,
      updatedAt: null,
      data: sampleOverview(from, to),
      note: 'Showing sample subscriber data — connect Klaviyo for live numbers.',
    }
  }

  // Fetch the two pieces independently so one failure doesn't blank the page,
  // and capture the exact status so we can diagnose without server logs.
  const problems: string[] = []
  let lists: ListCount[] = []
  let monthly = monthBuckets()
  let capped = false

  try {
    lists = await fetchLists(v.apiKey)
  } catch (e) {
    problems.push(errMsg(e))
  }
  try {
    const r = await fetchNewByMonth(v.apiKey)
    monthly = r.monthly
    capped = r.capped
  } catch (e) {
    problems.push(errMsg(e))
  }

  const gotLists = lists.length > 0
  const gotMonthly = monthly.some((m) => m.count > 0)

  // Total failure → sample data, but report exactly which calls failed.
  if (!gotLists && !gotMonthly) {
    return {
      status: 'disconnected',
      updatedAt: null,
      data: sampleOverview(from, to),
      note: `Klaviyo request failed (${problems.join('; ') || 'no data'}) — showing sample data. A 401/403 usually means the API key lacks List/Profiles read access.`,
    }
  }

  const totalContacts = lists.reduce((max, l) => Math.max(max, l.count), 0)
  const fromM = from.slice(0, 7)
  const toM = to.slice(0, 7)
  const newContacts = monthly
    .filter((m) => m.month >= fromM && m.month <= toM)
    .reduce((s, m) => s + m.count, 0)
  const newPerMonthAvg = Math.round(monthly.reduce((s, m) => s + m.count, 0) / monthly.length)
  // Growth % only makes sense with a known total; guard against divide-by-tiny.
  const prior = totalContacts - newContacts
  const growthRatePct = totalContacts > 0 && prior > 0 ? round(newContacts / prior) : 0

  return {
    status: problems.length ? 'disconnected' : 'connected',
    updatedAt: new Date().toISOString(),
    data: {
      totalContacts,
      newContacts,
      newPerMonthAvg,
      growthRatePct,
      monthly,
      lists,
      capped,
    },
    note: problems.length ? `Partial Klaviyo data — ${problems.join('; ')}.` : undefined,
  }
}

/**
 * Lists and their profile counts. Enumerate first (always works), then enrich
 * with profile_count per list via the single-list endpoint — the collection
 * endpoint rejects additional-fields[list]=profile_count with a 400, but the
 * single-list endpoint accepts it. Per-list count failures are tolerated.
 */
async function fetchLists(apiKey: string): Promise<ListCount[]> {
  const res = await fetch(`${BASE}/lists/`, { headers: headers(apiKey) })
  if (!res.ok) throw new Error(`lists ${res.status}`)
  const json = (await res.json()) as {
    data?: { id?: string; attributes?: { name?: string } }[]
  }
  const base = (json.data ?? []).map((l) => ({
    id: l.id ?? '',
    name: l.attributes?.name ?? 'List',
  }))

  const withCounts = await Promise.all(
    base.slice(0, 25).map(async (l) => {
      let count = 0
      if (l.id) {
        try {
          const r = await fetch(
            `${BASE}/lists/${l.id}/?additional-fields[list]=profile_count`,
            { headers: headers(apiKey) },
          )
          if (r.ok) {
            const j = (await r.json()) as { data?: { attributes?: { profile_count?: number } } }
            count = j.data?.attributes?.profile_count ?? 0
          }
        } catch {
          /* tolerate — leave count at 0 */
        }
      }
      return { name: l.name, count }
    }),
  )
  return withCounts.sort((a, b) => b.count - a.count)
}

/**
 * New profiles per month over the trailing 12 months. Pages newest-first and
 * stops once it reaches profiles older than the 12-month window — no date
 * filter param (which is a common source of 400s), just sort + page[size].
 */
async function fetchNewByMonth(apiKey: string): Promise<{ monthly: SubscriberMonth[]; capped: boolean }> {
  const monthly = monthBuckets()
  const byMonth = new Map(monthly.map((m) => [m.month, m]))
  const firstMonth = monthly[0].month // 'YYYY-MM'

  // Literal brackets — Klaviyo's JSON:API rejects percent-encoded brackets.
  let url: string | null = `${BASE}/profiles/?sort=-created&fields[profile]=created&page[size]=100`
  let pages = 0
  let capped = false
  let reachedOld = false

  while (url && pages < MAX_PROFILE_PAGES && !reachedOld) {
    const res: Response = await fetch(url, { headers: headers(apiKey) })
    if (!res.ok) {
      if (pages === 0) throw new Error(`profiles ${res.status}`)
      break
    }
    const json = (await res.json()) as {
      data?: { attributes?: { created?: string } }[]
      links?: { next?: string | null }
    }
    for (const p of json.data ?? []) {
      const created = p.attributes?.created
      if (!created) continue
      const mk = created.slice(0, 7)
      if (mk < firstMonth) {
        reachedOld = true // sorted newest-first, so everything after is older too
        break
      }
      const bucket = byMonth.get(mk)
      if (bucket) bucket.count += 1
    }
    url = json.links?.next ?? null
    pages++
    if (url && pages >= MAX_PROFILE_PAGES && !reachedOld) capped = true
  }

  return { monthly, capped }
}

// ── Sample fallback ──────────────────────────────────────────────────────
function sampleOverview(from: string, to: string): KlaviyoOverview {
  const monthly = monthBuckets().map((m, i) => {
    const isJan = m.month.endsWith('-01')
    const base = 90 + i * 9 // gentle upward trend
    return { ...m, count: isJan ? Math.round(base * 2.1) : base }
  })
  const fromM = from.slice(0, 7)
  const toM = to.slice(0, 7)
  const newContacts = monthly
    .filter((m) => m.month >= fromM && m.month <= toM)
    .reduce((s, m) => s + m.count, 0)
  const totalContacts = 11840
  const newPerMonthAvg = Math.round(monthly.reduce((s, m) => s + m.count, 0) / monthly.length)
  return {
    totalContacts,
    newContacts,
    newPerMonthAvg,
    growthRatePct: round(newContacts / Math.max(1, totalContacts - newContacts)),
    monthly,
    lists: [
      { name: 'Newsletter (Email)', count: totalContacts },
      { name: 'SMS Subscribers', count: 1820 },
      { name: 'Trial — Active', count: 640 },
    ],
    capped: false,
  }
}
