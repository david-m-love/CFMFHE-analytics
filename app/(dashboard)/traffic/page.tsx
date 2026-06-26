'use client'

import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Info } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { KpiCard } from '@/components/kpi-card'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChartTooltip } from '@/components/charts/ChartTooltip'
import { useDashboard } from '@/store/dashboard'
import type { DataEnvelope } from '@/types'
import type { TrafficData } from '@/lib/ga4'
import { cn, formatNumber, formatPercent } from '@/lib/utils'

const GRID = 'rgba(28,27,24,0.07)'
const AXIS = '#9C9890'
const SOURCE_COLORS = ['#3B6FA0', '#2A7A58', '#6B5EA8', '#C4A030', '#D07830', '#9C9890']

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}m ${s}s`
}

export default function TrafficPage() {
  const { range, compareEnabled, compareRange } = useDashboard()
  const [data, setData] = useState<TrafficData | null>(null)
  const [compare, setCompare] = useState<TrafficData | null>(null)
  const [status, setStatus] = useState<'connected' | 'mock' | 'disconnected'>('mock')
  const [note, setNote] = useState<string>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    const main = fetch(`/api/data/ga4?from=${range.from}&to=${range.to}`, { cache: 'no-store' }).then(
      (r) => r.json() as Promise<DataEnvelope<TrafficData>>,
    )
    const cmp =
      compareEnabled && compareRange
        ? fetch(`/api/data/ga4?from=${compareRange.from}&to=${compareRange.to}`, { cache: 'no-store' }).then(
            (r) => r.json() as Promise<DataEnvelope<TrafficData>>,
          )
        : Promise.resolve(null)
    Promise.all([main, cmp])
      .then(([m, c]) => {
        if (!active) return
        setData(m.data)
        setStatus(m.status as 'connected' | 'mock' | 'disconnected')
        setNote(m.note)
        setCompare(c?.data ?? null)
        setLoading(false)
      })
      .catch(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [range.from, range.to, compareEnabled, compareRange])

  const totalSrc = data ? data.sources.reduce((s, x) => s + x.sessions, 0) || 1 : 1
  const maxPage = data ? Math.max(1, ...data.topPages.map((p) => p.sessions)) : 1
  const joinConv = data && data.totals.sessions ? data.totals.joinUsSessions / data.totals.sessions : 0

  return (
    <>
      <PageHeader title="Traffic" description="Website sessions, sources, and the /join-us path (GA4)." showSource={false} />

      {status !== 'connected' && !loading && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-[#ecdcc2] bg-[#f6eddf] px-3 py-2 text-xs text-accent-amber">
          <Info size={14} className="shrink-0" />
          {note ?? 'Showing sample traffic data.'}
        </div>
      )}

      {loading || !data ? (
        <div className="h-96 animate-pulse rounded-lg border border-border bg-card" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <KpiCard label="Sessions" value={data.totals.sessions} previous={compare?.totals.sessions} format="number" />
            <Card className="p-4">
              <div className="font-mono text-[11px] uppercase tracking-wide text-text-3">New vs Returning</div>
              <div className="mt-1.5 font-mono text-2xl text-ink">{formatPercent(data.totals.newPct, 0)}</div>
              <div className="mt-1 text-xs text-text-2">
                new · {formatPercent(data.totals.returningPct, 0)} returning
              </div>
            </Card>
            <KpiCard label="/join-us Sessions" value={data.totals.joinUsSessions} previous={compare?.totals.joinUsSessions} format="number" />
            <Card className="p-4">
              <div className="font-mono text-[11px] uppercase tracking-wide text-text-3">Avg Session</div>
              <div className="mt-1.5 font-mono text-2xl text-ink">{fmtDuration(data.totals.avgDurationSec)}</div>
              <div className="mt-1 text-xs text-text-2">time on site</div>
            </Card>
            <Card className="p-4">
              <div className="font-mono text-[11px] uppercase tracking-wide text-text-3">/join-us Bounce</div>
              <div className="mt-1.5 font-mono text-2xl text-ink">{formatPercent(data.totals.joinUsBounceRate, 0)}</div>
              <div className="mt-1 text-xs text-text-2">left after one page</div>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Sessions Over Time</CardTitle>
                <Badge tone="neutral">selected period</Badge>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.overTime} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={24} />
                    <YAxis tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#3B6FA0" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Traffic Sources</CardTitle>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={data.sources} dataKey="sessions" nameKey="channel" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="none">
                      {data.sources.map((_, i) => (
                        <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="mt-2 space-y-1 text-sm">
                  {data.sources.map((s, i) => (
                    <li key={s.channel} className="flex items-center gap-2 text-text-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                      <span className="truncate">{s.channel}</span>
                      <span className="ml-auto font-mono text-xs text-ink">{formatPercent(s.sessions / totalSrc, 0)}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Landing Pages</CardTitle>
              </CardHeader>
              <CardBody className="space-y-2">
                {data.topPages.map((p) => (
                  <div key={p.path}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-mono text-text-2">{p.path}</span>
                      <span className="ml-2 font-mono tabular-nums text-ink">{formatNumber(p.sessions)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper">
                      <div className="h-full rounded-full bg-accent-blue" style={{ width: `${(p.sessions / maxPage) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>/join-us Path</CardTitle>
                <Badge tone="neutral">membership landing</Badge>
              </CardHeader>
              <CardBody>
                <FunnelRow label="All sessions" value={data.totals.sessions} max={data.totals.sessions} color="#3B6FA0" />
                <FunnelRow label="/join-us sessions" value={data.totals.joinUsSessions} max={data.totals.sessions} color="#2A7A58" sub={`${formatPercent(joinConv, 1)} of all sessions`} />
                <div className="mt-2 rounded-md bg-paper px-3 py-2 text-xs text-text-2">
                  <strong>CTA click → trial start</strong> need GA4 event tracking configured on the
                  “Start Free Trial” button. Once those events exist, this becomes a full funnel.
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </>
  )
}

function FunnelRow({
  label,
  value,
  max,
  color,
  sub,
}: {
  label: string
  value: number
  max: number
  color: string
  sub?: string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-2">{label}</span>
        <span className="font-mono tabular-nums text-ink">{formatNumber(value)}</span>
      </div>
      <div className="mt-1 h-6 overflow-hidden rounded-md bg-paper">
        <div className={cn('flex h-full items-center rounded-md px-2')} style={{ width: `${Math.max(6, pct)}%`, background: color }} />
      </div>
      {sub && <div className="mt-0.5 font-mono text-[10px] text-text-3">{sub}</div>}
    </div>
  )
}
