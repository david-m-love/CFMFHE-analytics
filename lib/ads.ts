import type { DataEnvelope, SourceStatus } from '@/types'
import { resolveCredential } from './credentials'
import { getStoredCredential, saveCredential } from './credentials-store'
import type { ConnId } from './connection-defs'
import {
  type AdCampaign,
  type AdSource,
  type AdSpendData,
} from './campaign-mapping'

// Ad-spend connectors (Meta Ads + Google Ads). Each gracefully falls back to
// deterministic sample campaigns when not connected, so the CMO dashboard and
// the campaign→product mapping UI work end-to-end before any account is wired.

const META_GRAPH = 'https://graph.facebook.com/v21.0'
export const META_AUTHORIZE_URL = 'https://www.facebook.com/v21.0/dialog/oauth'
export const META_SCOPE = 'ads_read'

export const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords'

const round = (n: number) => Math.round(n * 100) / 100

/** Merge new fields (e.g. OAuth tokens) into a stored credential blob. */
export async function mergeCredential(id: ConnId, patch: Record<string, string>): Promise<void> {
  const existing = (await getStoredCredential(id)) ?? {}
  await saveCredential(id, { ...existing, ...patch })
}

function daysInRange(from: string, to: string): number {
  const a = Date.parse(from)
  const b = Date.parse(to)
  if (!isFinite(a) || !isFinite(b) || b < a) return 30
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1)
}

// ── Sample data ────────────────────────────────────────────────────────────
// Daily spend rates → prorated by the selected window, so sample ROAS stays
// sensible at any range. Names deliberately resemble the catalog so the
// suggested-match mapping demonstrates well.
const SAMPLE_META: { name: string; status: 'active' | 'paused'; daily: number }[] = [
  { name: 'Prospecting — Digital Membership', status: 'active', daily: 120 },
  { name: 'Retargeting — Yearly Membership', status: 'active', daily: 80 },
  { name: 'Easter Bundle — Seasonal', status: 'paused', daily: 35 },
  { name: 'Broad — Workbook Only', status: 'active', daily: 55 },
]
const SAMPLE_GOOGLE: { name: string; status: 'active' | 'paused'; daily: number }[] = [
  { name: 'Search — Come Follow Me', status: 'active', daily: 90 },
  { name: 'Brand — CFMFHE', status: 'active', daily: 25 },
  { name: 'Shopping — Flipbook', status: 'active', daily: 50 },
  { name: 'PMax — Memberships', status: 'paused', daily: 60 },
]

function sampleCampaigns(source: AdSource, from: string, to: string): AdCampaign[] {
  const days = daysInRange(from, to)
  const defs = source === 'meta' ? SAMPLE_META : SAMPLE_GOOGLE
  return defs.map((d, i) => ({
    id: `${source}:sample-${i}`,
    source,
    name: d.name,
    status: d.status,
    spend: round(d.daily * days * (d.status === 'paused' ? 0.4 : 1)),
  }))
}

// ── Meta Ads ─────────────────────────────────────────────────────────────
async function fetchMetaCampaigns(from: string, to: string): Promise<AdCampaign[] | null> {
  const v = await resolveCredential('meta')
  if (!v.accessToken || !v.adAccountId) return null
  const acct = v.adAccountId.startsWith('act_') ? v.adAccountId : `act_${v.adAccountId}`
  const timeRange = encodeURIComponent(JSON.stringify({ since: from, until: to }))
  const url =
    `${META_GRAPH}/${acct}/insights?level=campaign` +
    `&fields=campaign_id,campaign_name,spend&time_range=${timeRange}` +
    `&limit=500&access_token=${encodeURIComponent(v.accessToken)}`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`Meta insights ${res.status}`)
  const json = (await res.json()) as {
    data?: { campaign_id?: string; campaign_name?: string; spend?: string }[]
  }
  return (json.data ?? []).map((c) => ({
    id: `meta:${c.campaign_id ?? c.campaign_name ?? Math.abs(hash(c.campaign_name ?? ''))}`,
    source: 'meta' as AdSource,
    name: c.campaign_name ?? 'Untitled campaign',
    status: 'active' as const,
    spend: round(parseFloat(c.spend ?? '0') || 0),
  }))
}

// ── Google Ads ─────────────────────────────────────────────────────────────
async function refreshGoogleToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string | null> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  const json = (await res.json()) as { access_token?: string }
  return json.access_token ?? null
}

async function fetchGoogleCampaigns(from: string, to: string): Promise<AdCampaign[] | null> {
  const v = await resolveCredential('google_ads')
  if (!v.clientId || !v.clientSecret || !v.refreshToken || !v.developerToken || !v.customerId) {
    return null
  }
  const accessToken = await refreshGoogleToken(v.clientId, v.clientSecret, v.refreshToken)
  if (!accessToken) throw new Error('Google token refresh failed')
  const customer = v.customerId.replace(/-/g, '')
  const query =
    `SELECT campaign.name, campaign.status, metrics.cost_micros FROM campaign ` +
    `WHERE segments.date BETWEEN '${from}' AND '${to}'`
  const res = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customer}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': v.developerToken,
        ...(v.loginCustomerId ? { 'login-customer-id': v.loginCustomerId.replace(/-/g, '') } : {}),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  )
  if (!res.ok) throw new Error(`Google Ads ${res.status}`)
  const json = (await res.json()) as {
    results?: {
      campaign?: { name?: string; status?: string }
      metrics?: { costMicros?: string }
    }[]
  }[]
  const rows = Array.isArray(json) ? json.flatMap((b) => b.results ?? []) : []
  const byName = new Map<string, AdCampaign>()
  for (const r of rows) {
    const name = r.campaign?.name ?? 'Untitled campaign'
    const spend = round((parseInt(r.metrics?.costMicros ?? '0', 10) || 0) / 1_000_000)
    const existing = byName.get(name)
    if (existing) existing.spend = round(existing.spend + spend)
    else
      byName.set(name, {
        id: `google_ads:${Math.abs(hash(name))}`,
        source: 'google_ads',
        name,
        status: (r.campaign?.status ?? '').toUpperCase() === 'ENABLED' ? 'active' : 'paused',
        spend,
      })
  }
  return [...byName.values()]
}

// ── Aggregate ────────────────────────────────────────────────────────────
export async function getAdSpend(from: string, to: string): Promise<DataEnvelope<AdSpendData>> {
  const sources: { source: AdSource; fetcher: () => Promise<AdCampaign[] | null> }[] = [
    { source: 'meta', fetcher: () => fetchMetaCampaigns(from, to) },
    { source: 'google_ads', fetcher: () => fetchGoogleCampaigns(from, to) },
  ]

  const campaigns: AdCampaign[] = []
  const bySource: Record<AdSource, number> = { meta: 0, google_ads: 0 }
  let anyConnected = false
  let anyError = false

  for (const { source, fetcher } of sources) {
    try {
      const result = await fetcher()
      if (result === null) continue // not connected — contributes nothing real
      anyConnected = true
      campaigns.push(...result)
      bySource[source] = round(result.reduce((s, c) => s + c.spend, 0))
    } catch (e) {
      anyError = true
      console.error(`[ads] ${source} failed:`, e)
    }
  }

  if (!anyConnected) {
    const sample = [...sampleCampaigns('meta', from, to), ...sampleCampaigns('google_ads', from, to)]
    return {
      status: 'mock' as SourceStatus,
      updatedAt: null,
      data: {
        campaigns: sample,
        bySource: {
          meta: round(sampleCampaigns('meta', from, to).reduce((s, c) => s + c.spend, 0)),
          google_ads: round(sampleCampaigns('google_ads', from, to).reduce((s, c) => s + c.spend, 0)),
        },
        total: round(sample.reduce((s, c) => s + c.spend, 0)),
      },
      note: 'Showing sample ad spend — connect Meta or Google Ads for live numbers.',
    }
  }

  return {
    status: anyError ? 'disconnected' : 'connected',
    updatedAt: new Date().toISOString(),
    data: { campaigns, bySource, total: round(campaigns.reduce((s, c) => s + c.spend, 0)) },
    note: anyError ? 'One ad source failed; showing what we could fetch.' : undefined,
  }
}

/** Lightweight connection check for the Connections page. */
export async function adsConnected(
  id: 'meta' | 'google_ads',
): Promise<{ ok: boolean; needsAuth: boolean }> {
  const v = await resolveCredential(id)
  if (id === 'meta') {
    if (!v.appId || !v.appSecret) return { ok: false, needsAuth: false }
    return { ok: Boolean(v.accessToken && v.adAccountId), needsAuth: !v.accessToken }
  }
  if (!v.clientId || !v.clientSecret || !v.developerToken || !v.customerId) {
    return { ok: false, needsAuth: false }
  }
  return { ok: Boolean(v.refreshToken), needsAuth: !v.refreshToken }
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}
