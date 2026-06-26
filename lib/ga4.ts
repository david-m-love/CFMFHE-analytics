import { JWT } from 'google-auth-library'
import type { DataEnvelope, SourceStatus } from '@/types'
import { resolveCredential } from './credentials'

export interface TrafficTotals {
  sessions: number
  newPct: number
  returningPct: number
  joinUsSessions: number
  avgDurationSec: number
  joinUsBounceRate: number
}
export interface TimePoint {
  date: string
  label: string
  sessions: number
}
export interface ChannelSlice {
  channel: string
  sessions: number
}
export interface PageRow {
  path: string
  sessions: number
}
export interface TrafficData {
  totals: TrafficTotals
  overTime: TimePoint[]
  sources: ChannelSlice[]
  topPages: PageRow[]
}

const ANALYTICS_DATA = 'https://analyticsdata.googleapis.com/v1beta'

function dayLabel(yyyymmdd: string): string {
  const y = +yyyymmdd.slice(0, 4)
  const m = +yyyymmdd.slice(4, 6)
  const d = +yyyymmdd.slice(6, 8)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

async function runReport(
  propertyId: string,
  token: string,
  body: Record<string, unknown>,
): Promise<{ rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[] }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  try {
    const res = await fetch(`${ANALYTICS_DATA}/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`GA4 runReport ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchReal(
  propertyId: string,
  clientEmail: string,
  privateKey: string,
  from: string,
  to: string,
): Promise<TrafficData> {
  const jwt = new JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  })
  const { token } = await jwt.getAccessToken()
  if (!token) throw new Error('GA4 auth failed')
  const dateRanges = [{ startDate: from, endDate: to }]
  const num = (v?: string) => (v ? parseFloat(v) : 0)

  const [totalsR, nvrR, timeR, srcR, pagesR, joinR] = await Promise.all([
    runReport(propertyId, token, { dateRanges, metrics: [{ name: 'sessions' }, { name: 'averageSessionDuration' }] }),
    runReport(propertyId, token, { dateRanges, dimensions: [{ name: 'newVsReturning' }], metrics: [{ name: 'sessions' }] }),
    runReport(propertyId, token, { dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'sessions' }], orderBys: [{ dimension: { dimensionName: 'date' } }] }),
    runReport(propertyId, token, { dateRanges, dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] }),
    runReport(propertyId, token, { dateRanges, dimensions: [{ name: 'landingPagePlusQueryString' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 8 }),
    runReport(propertyId, token, {
      dateRanges,
      metrics: [{ name: 'sessions' }, { name: 'bounceRate' }],
      dimensionFilter: { filter: { fieldName: 'landingPagePlusQueryString', stringFilter: { matchType: 'CONTAINS', value: '/join-us' } } },
    }),
  ])

  const sessions = num(totalsR.rows?.[0]?.metricValues?.[0]?.value)
  const avgDurationSec = num(totalsR.rows?.[0]?.metricValues?.[1]?.value)
  let newS = 0
  let retS = 0
  for (const r of nvrR.rows ?? []) {
    const v = num(r.metricValues?.[0]?.value)
    if (r.dimensionValues?.[0]?.value === 'returning') retS += v
    else newS += v
  }
  const nvrTotal = newS + retS || 1
  const joinUsSessions = num(joinR.rows?.[0]?.metricValues?.[0]?.value)
  const joinUsBounceRate = num(joinR.rows?.[0]?.metricValues?.[1]?.value)

  return {
    totals: {
      sessions,
      newPct: newS / nvrTotal,
      returningPct: retS / nvrTotal,
      joinUsSessions,
      avgDurationSec,
      joinUsBounceRate,
    },
    overTime: (timeR.rows ?? []).map((r) => {
      const d = r.dimensionValues?.[0]?.value ?? ''
      return { date: d, label: dayLabel(d), sessions: num(r.metricValues?.[0]?.value) }
    }),
    sources: (srcR.rows ?? []).map((r) => ({
      channel: r.dimensionValues?.[0]?.value ?? 'Unknown',
      sessions: num(r.metricValues?.[0]?.value),
    })),
    topPages: (pagesR.rows ?? []).map((r) => ({
      path: r.dimensionValues?.[0]?.value ?? '/',
      sessions: num(r.metricValues?.[0]?.value),
    })),
  }
}

// ── Deterministic sample ───────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sampleTraffic(from: string, to: string): TrafficData {
  const start = new Date(from)
  const end = new Date(to)
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
  const rng = mulberry32(20260626)
  const overTime: TimePoint[] = []
  let total = 0
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    const iso = d.toISOString().slice(0, 10)
    const dow = d.getUTCDay()
    const weekend = dow === 0 || dow === 6
    const sessions = Math.round((weekend ? 380 : 620) * (0.8 + rng() * 0.4))
    total += sessions
    overTime.push({
      date: iso.replace(/-/g, ''),
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sessions,
    })
  }
  const sources: ChannelSlice[] = [
    { channel: 'Organic Search', sessions: Math.round(total * 0.41) },
    { channel: 'Direct', sessions: Math.round(total * 0.24) },
    { channel: 'Organic Social', sessions: Math.round(total * 0.16) },
    { channel: 'Email', sessions: Math.round(total * 0.11) },
    { channel: 'Paid Search', sessions: Math.round(total * 0.08) },
  ]
  const topPages: PageRow[] = [
    { path: '/', sessions: Math.round(total * 0.34) },
    { path: '/join-us', sessions: Math.round(total * 0.1) },
    { path: '/lessons', sessions: Math.round(total * 0.09) },
    { path: '/free-downloads', sessions: Math.round(total * 0.07) },
    { path: '/shop', sessions: Math.round(total * 0.05) },
  ]
  return {
    totals: {
      sessions: total,
      newPct: 0.68,
      returningPct: 0.32,
      joinUsSessions: Math.round(total * 0.1),
      avgDurationSec: 134,
      joinUsBounceRate: 0.58,
    },
    overTime,
    sources,
    topPages,
  }
}

export async function getTraffic(from: string, to: string): Promise<DataEnvelope<TrafficData>> {
  const v = await resolveCredential('ga4')
  if (!v.clientEmail || !v.privateKey || !v.propertyId) {
    return {
      status: 'mock' as SourceStatus,
      updatedAt: null,
      data: sampleTraffic(from, to),
      note: 'Showing sample traffic — Google Analytics 4 not connected.',
    }
  }
  try {
    const data = await fetchReal(v.propertyId, v.clientEmail, v.privateKey, from, to)
    return { status: 'connected', updatedAt: new Date().toISOString(), data }
  } catch (e) {
    console.error('[ga4] failed:', e)
    return {
      status: 'disconnected',
      updatedAt: null,
      data: sampleTraffic(from, to),
      note: 'GA4 is connected but the data request failed — showing sample data.',
    }
  }
}
