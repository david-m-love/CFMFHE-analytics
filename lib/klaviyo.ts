import type { DataEnvelope, SourceStatus } from '@/types'
import { resolveCredential } from './credentials'

// Klaviyo subscriber growth — measured by MARKETING CONSENT, not raw profiles.
// "New" counts only profiles that are actually subscribed (email or SMS), so
// buyers who never opted in are excluded. Real data when the API key is set,
// otherwise deterministic sample data so the page always renders.

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
  email: number
  sms: number
}
export interface KlaviyoOverview {
  emailSubscribers: number
  smsSubscribers: number
  newEmail: number // subscribed profiles created within [from, to]
  newSms: number
  emailGrowthPct: number // newEmail ÷ prior email subscribers
  newPerMonthAvg: number // email + sms, trailing 12 mo
  monthly: SubscriberMonth[] // last 12 months of new subscribers by channel
  lists: ListCount[]
  capped: boolean // true if profile paging hit the cap (older months undercount)
}

const round = (n: number) => Math.round(n * 100) / 100
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'failed')

function headers(apiKey: string) {
  return {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: REVISION,
    accept: 'application/json',
  }
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
    const r = await fetchNewSubscribersByMonth(v.apiKey)
    monthly = r.monthly
    capped = r.capped
  } catch (e) {
    problems.push(errMsg(e))
  }

  const gotLists = lists.length > 0
  const gotMonthly = monthly.some((m) => m.email > 0 || m.sms > 0)

  if (!gotLists && !gotMonthly) {
    return {
      status: 'disconnected',
      updatedAt: null,
      data: sampleOverview(from, to),
      note: `Klaviyo request failed (${problems.join('; ') || 'no data'}) — showing sample data. A 401/403 usually means the API key lacks List/Profiles read access.`,
    }
  }

  // Subscriber totals from lists: SMS list by name, email = largest non-SMS list.
  const smsList = lists.find((l) => /sms|text|phone/i.test(l.name))
  const emailList = lists.find((l) => l !== smsList)
  const emailSubscribers = emailList?.count ?? 0
  const smsSubscribers = smsList?.count ?? 0

  const fromM = from.slice(0, 7)
  const toM = to.slice(0, 7)
  const inRange = monthly.filter((m) => m.month >= fromM && m.month <= toM)
  const newEmail = inRange.reduce((s, m) => s + m.email, 0)
  const newSms = inRange.reduce((s, m) => s + m.sms, 0)
  const newPerMonthAvg = Math.round(
    monthly.reduce((s, m) => s + m.email + m.sms, 0) / monthly.length,
  )
  const priorEmail = emailSubscribers - newEmail
  const emailGrowthPct = emailSubscribers > 0 && priorEmail > 0 ? round(newEmail / priorEmail) : 0

  return {
    status: problems.length ? 'disconnected' : 'connected',
    updatedAt: new Date().toISOString(),
    data: {
      emailSubscribers,
      smsSubscribers,
      newEmail,
      newSms,
      emailGrowthPct,
      newPerMonthAvg,
      monthly,
      lists,
      capped,
    },
    note: problems.length ? `Partial Klaviyo data — ${problems.join('; ')}.` : undefined,
  }
}

/** Lists + per-list profile counts (enumerate, then enrich via single-list endpoint). */
async function fetchLists(apiKey: string): Promise<ListCount[]> {
  const res = await fetch(`${BASE}/lists/`, { headers: headers(apiKey) })
  if (!res.ok) throw new Error(`lists ${res.status}`)
  const json = (await res.json()) as {
    data?: { id?: string; attributes?: { name?: string } }[]
  }
  const base = (json.data ?? []).map((l) => ({ id: l.id ?? '', name: l.attributes?.name ?? 'List' }))

  const withCounts = await Promise.all(
    base.slice(0, 25).map(async (l) => {
      let count = 0
      if (l.id) {
        try {
          const r = await fetch(`${BASE}/lists/${l.id}/?additional-fields[list]=profile_count`, {
            headers: headers(apiKey),
          })
          if (r.ok) {
            const j = (await r.json()) as { data?: { attributes?: { profile_count?: number } } }
            count = j.data?.attributes?.profile_count ?? 0
          }
        } catch {
          /* tolerate */
        }
      }
      return { name: l.name, count }
    }),
  )
  return withCounts.sort((a, b) => b.count - a.count)
}

interface ProfileSubs {
  email?: { marketing?: { consent?: string } }
  sms?: { marketing?: { consent?: string } }
}

/**
 * New SUBSCRIBERS per month (trailing 12 mo), split by channel. Pages profiles
 * newest-first, keeps only those whose marketing consent is SUBSCRIBED, and
 * buckets by profile-created month. Stops once past the 12-month window.
 * Caveat: uses profile-created date as the subscribe date and reflects CURRENT
 * consent (someone who later unsubscribed won't count).
 */
async function fetchNewSubscribersByMonth(
  apiKey: string,
): Promise<{ monthly: SubscriberMonth[]; capped: boolean }> {
  const monthly = monthBuckets()
  const byMonth = new Map(monthly.map((m) => [m.month, m]))
  const firstMonth = monthly[0].month

  let url: string | null =
    `${BASE}/profiles/?sort=-created&fields[profile]=created,subscriptions&page[size]=100`
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
      data?: { attributes?: { created?: string; subscriptions?: ProfileSubs } }[]
      links?: { next?: string | null }
    }
    for (const p of json.data ?? []) {
      const created = p.attributes?.created
      if (!created) continue
      const mk = created.slice(0, 7)
      if (mk < firstMonth) {
        reachedOld = true
        break
      }
      const bucket = byMonth.get(mk)
      if (!bucket) continue
      const subs = p.attributes?.subscriptions
      if (subs?.email?.marketing?.consent === 'SUBSCRIBED') bucket.email += 1
      if (subs?.sms?.marketing?.consent === 'SUBSCRIBED') bucket.sms += 1
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
    const email = (isJan ? 210 : 95 + i * 7)
    return { ...m, email, sms: Math.round(email * 0.22) }
  })
  const fromM = from.slice(0, 7)
  const toM = to.slice(0, 7)
  const inRange = monthly.filter((m) => m.month >= fromM && m.month <= toM)
  const newEmail = inRange.reduce((s, m) => s + m.email, 0)
  const newSms = inRange.reduce((s, m) => s + m.sms, 0)
  const emailSubscribers = 9820
  const smsSubscribers = 1840
  return {
    emailSubscribers,
    smsSubscribers,
    newEmail,
    newSms,
    emailGrowthPct: round(newEmail / Math.max(1, emailSubscribers - newEmail)),
    newPerMonthAvg: Math.round(monthly.reduce((s, m) => s + m.email + m.sms, 0) / monthly.length),
    monthly,
    lists: [
      { name: 'Newsletter (Email)', count: emailSubscribers },
      { name: 'SMS Subscribers', count: smsSubscribers },
      { name: 'Trial — Active', count: 640 },
    ],
    capped: false,
  }
}
