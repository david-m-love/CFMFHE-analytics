'use client'

import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/page-header'
import { MembershipTabs } from '@/components/membership/MembershipTabs'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChartTooltip } from '@/components/charts/ChartTooltip'
import { useOrdersMeta, useStoreOrders } from '@/lib/use-orders'
import {
  MILESTONES,
  type PlanFilter,
  getCohortAnalysis,
} from '@/lib/cohorts'
import { cn, formatPercent } from '@/lib/utils'

const GRID = 'rgba(28,27,24,0.07)'
const AXIS = '#9C9890'
const YEAR_COLORS: Record<string, string> = {
  '2023': '#9C9890',
  '2024': '#5A9E8A',
  '2025': '#3B6FA0',
  '2026': '#D07830',
}

const PLAN_OPTIONS: { value: PlanFilter; label: string }[] = [
  { value: 'all', label: 'All plans' },
  { value: 'monthly', label: 'Monthly only' },
  { value: 'yearly', label: 'Yearly only' },
]

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
function mix(c1: number[], c2: number[], t: number) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ]
}
/** Pale red→amber→green heat color for a retention fraction. */
function heatColor(v: number | null): string {
  if (v == null) return 'transparent'
  const red = [176, 64, 53]
  const amber = [196, 160, 48]
  const green = [42, 122, 88]
  let c: number[]
  if (v <= 0.15) c = red
  else if (v >= 0.75) c = green
  else if (v < 0.45) c = mix(red, amber, (v - 0.15) / 0.3)
  else c = mix(amber, green, (v - 0.45) / 0.3)
  const pale = mix(c, [255, 255, 255], 0.6)
  return `rgb(${pale[0]},${pale[1]},${pale[2]})`
}

export default function CohortsPage() {
  const { loading, status } = useOrdersMeta()
  const orders = useStoreOrders()
  const [plan, setPlan] = useState<PlanFilter>('all')

  const analysis = useMemo(
    () => getCohortAnalysis(orders, status, plan),
    [orders, status, plan],
  )

  const yoyData = useMemo(
    () =>
      MILESTONES.map((m, i) => {
        const row: Record<string, number | string | null> = { label: `Mo ${m}` }
        analysis.januaryYoY.forEach((s) => {
          row[String(s.year)] = s.retention[i] != null ? Math.round(s.retention[i]! * 100) : null
        })
        return row
      }),
    [analysis],
  )

  const churnData = useMemo(
    () => analysis.churnDistribution.map((c) => ({ bucket: c.bucket, pct: Math.round(c.pct * 1000) / 10 })),
    [analysis],
  )

  const avg3 = analysis.avgRetention[1]
  const avg6 = analysis.avgRetention[2]
  const avg12 = analysis.avgRetention[4]

  return (
    <>
      <PageHeader
        title="Membership"
        description="Cohort retention — how each acquisition group holds up over time."
      />
      <MembershipTabs />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-border bg-card p-0.5">
          {PLAN_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setPlan(o.value)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                plan === o.value ? 'bg-ink text-white' : 'text-text-2 hover:bg-paper',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="font-mono text-[10px] text-text-3">
          {analysis.sampled ? 'Modeled sample · ' : ''}Full acquisition history · date
          range not applied
        </p>
      </div>

      {loading ? (
        <div className="h-80 animate-pulse rounded-lg border border-border bg-card" />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <MiniStat label="Avg Mo-3 Retention" value={avg3} />
            <MiniStat label="Avg Mo-6 Retention" value={avg6} />
            <MiniStat label="Avg Mo-12 Retention" value={avg12} />
          </div>

          {/* Heat map */}
          <Card className="mb-4">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Cohort Retention</CardTitle>
              <Badge tone="neutral">% still active · green = higher</Badge>
            </CardHeader>
            <CardBody className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-text-3">
                      Cohort
                    </th>
                    <th className="px-2 py-1 text-right font-mono text-[10px] uppercase tracking-wide text-text-3">
                      Size
                    </th>
                    {MILESTONES.map((m) => (
                      <th
                        key={m}
                        className="px-2 py-1 text-center font-mono text-[10px] uppercase tracking-wide text-text-3"
                      >
                        Mo {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analysis.rows.map((r) => (
                    <tr key={r.startMonth}>
                      <td className="whitespace-nowrap px-2 py-1 font-medium text-ink">{r.label}</td>
                      <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-text-2">
                        {r.size}
                      </td>
                      {r.retention.map((v, i) => (
                        <td
                          key={i}
                          className="rounded text-center font-mono text-xs tabular-nums text-ink"
                          style={{ background: heatColor(v) }}
                        >
                          {v == null ? <span className="text-text-3">—</span> : formatPercent(v, 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>January Cohorts — Year over Year</CardTitle>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={yoyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
                      axisLine={{ stroke: GRID }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} />
                    {analysis.januaryYoY.map((s) => (
                      <Line
                        key={s.year}
                        type="monotone"
                        dataKey={String(s.year)}
                        name={String(s.year)}
                        stroke={YEAR_COLORS[String(s.year)] ?? '#1C1B18'}
                        strokeWidth={2}
                        connectNulls
                        dot={{ r: 2 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Churn Point Distribution</CardTitle>
                <Badge tone="neutral">when members leave</Badge>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={churnData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
                      axisLine={{ stroke: GRID }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(28,27,24,0.04)' }}
                      content={<ChartTooltip formatter={(v) => `${v}%`} />}
                    />
                    <Bar dataKey="pct" name="Churned" radius={[3, 3, 0, 0]}>
                      {churnData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={d.bucket === '13–18' ? '#B04035' : '#C45848'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-2 font-mono text-[10px] leading-snug text-text-3">
                  The 13–18 month bump = families finishing a curriculum year and not
                  re-enrolling — a May–July re-enroll campaign could recover many.
                </p>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </>
  )
}

function MiniStat({ label, value }: { label: string; value: number | null }) {
  return (
    <Card className="p-4">
      <div className="font-mono text-[11px] uppercase tracking-wide text-text-3">{label}</div>
      <div className="mt-1.5 font-serif text-2xl text-ink">
        {value == null ? '—' : formatPercent(value, 0)}
      </div>
    </Card>
  )
}
