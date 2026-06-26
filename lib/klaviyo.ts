import type { DataEnvelope, SourceStatus } from '@/types'
import { resolveCredential } from './credentials'

// Klaviyo subscriber growth. Real data when the API key is set, otherwise
// deterministic sample data so the Email & SMS dashboard always renders.

const BASE = 'https://a.klaviyo.com/api'
const REVISION = '2024-10-15'
const MAX_PROFILE_PAGES = 20 // cap paging at ~2,000 most-recent profiles

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

  try {
    const lists = await fetchLists(v.apiKey)
    const { monthly, capped } = await fetchNewByMonth(v.apiKey)

    const totalContacts = lists.reduce((max, l) => Math.max(max, l.count), 0)
    const fromM = from.slice(0, 7)
    const toM = to.slice(0, 7)
    const newContacts = monthly
      .filter((m) => m.month >= fromM && m.month <= toM)
      .reduce((s, m) => s + m.count, 0)
    const monthsWithData = monthly.filter((m) => m.count > 0).length || 1
    const newPerMonthAvg = Math.round(monthly.reduce((s, m) => s + m.count, 0) / monthsWithData)
    const prior = Math.max(1, totalContacts - newContacts)

    return {
      status: 'connected',
      updatedAt: new Date().toISOString(),
      data: {
        totalContacts,
        newContacts,
        newPerMonthAvg,
        growthRatePct: round(newContacts / prior),
        monthly,
        lists,
        capped,
      },
    }
  } catch (e) {
    console.error('[klaviyo] overview failed:', e)
    return {
      status: 'disconnected',
      updatedAt: null,
      data: sampleOverview(from, to),
      note: 'Klaviyo is connected but the request failed — showing sample data.',
    }
  }
}

/** Lists and their profile counts. */
async function fetchLists(apiKey: string): Promise<ListCount[]> {
  const res = await fetch(`${BASE}/lists/?additional-fields[list]=profile_count`, {
    headers: headers(apiKey),
  })
  if (!res.ok) throw new Error(`lists ${res.status}`)
  const json = (await res.json()) as {
    data?: { attributes?: { name?: string; profile_count?: number } }[]
  }
  return (json.data ?? [])
    .map((l) => ({ name: l.attributes?.name ?? 'List', count: l.attributes?.profile_count ?? 0 }))
    .sort((a, b) => b.count - a.count)
}

/** New profiles per month over the trailing 12 months (paged, sorted newest-first). */
async function fetchNewByMonth(apiKey: string): Promise<{ monthly: SubscriberMonth[]; capped: boolean }> {
  const monthly = monthBuckets()
  const byMonth = new Map(monthly.map((m) => [m.month, m]))
  const earliest = monthly[0].month + '-01T00:00:00Z'

  let url: string | null =
    `${BASE}/profiles/?filter=${encodeURIComponent(`greater-or-equal(created,${earliest})`)}` +
    `&sort=-created&fields[profile]=created&page[size]=100`
  let pages = 0
  let capped = false

  while (url && pages < MAX_PROFILE_PAGES) {
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
      const bucket = byMonth.get(created.slice(0, 7))
      if (bucket) bucket.count += 1
    }
    url = json.links?.next ?? null
    pages++
    if (url && pages >= MAX_PROFILE_PAGES) capped = true
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
