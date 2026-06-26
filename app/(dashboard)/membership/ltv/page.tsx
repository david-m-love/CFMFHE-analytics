'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { getLtvAnalysis } from '@/lib/ltv'
import { formatCurrency, formatPercent } from '@/lib/utils'

const GRID = 'rgba(28,27,24,0.07)'
const AXIS = '#9C9890'

export default function LtvPage() {
  const { loading, status } = useOrdersMeta()
  const orders = useStoreOrders()

  const a = useMemo(() => getLtvAnalysis(orders, status), [orders, status])

  const planData = a.byPlan.map((p) => ({
    label: p.label,
    Average: p.avgLtv,
    Median: p.medianLtv,
    tenure: p.avgTenure,
  }))

  return (
    <>
      <PageHeader
        title="Membership"
        description="Lifetime value — what members are worth, and how monthly buyers become annual."
      />
      <MembershipTabs />

      <div className="mb-4 flex items-center justify-end">
        <p className="font-mono text-[10px] text-text-3">
          {a.sampled ? 'Modeled sample · ' : ''}Full purchase history · date range not applied
        </p>
      </div>

      {loading ? (
        <div className="h-80 animate-pulse rounded-lg border border-border bg-card" />
      ) : (
        <>
          {/* Headline stats */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat label="Avg LTV" value={formatCurrency(a.avgLtv)} />
            <MiniStat label="Median LTV" value={formatCurrency(a.medianLtv)} />
            <MiniStat
              label="Top 10% of Customers"
              value={formatPercent(a.concentration.top10, 0)}
              sub="of all revenue"
            />
            <MiniStat
              label="Annual from Monthly"
              value={formatPercent(a.upgrade.pctFromMonthly, 0)}
              sub="upgraded, not direct"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* LTV by plan */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>LTV by First Plan</CardTitle>
                <Badge tone="neutral">average vs median</Badge>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={planData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: AXIS, fontSize: 9, fontFamily: 'var(--font-dm-mono)' }}
                      axisLine={{ stroke: GRID }}
                      tickLine={false}
                      interval={0}
                      angle={-18}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis
                      tickFormatter={(v) => formatCurrency(v, { compact: true })}
                      tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(28,27,24,0.04)' }}
                      content={<ChartTooltip formatter={(v) => formatCurrency(Number(v))} />}
                    />
                    <Bar dataKey="Average" fill="#3B6FA0" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Median" fill="#6B5EA8" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            {/* Avg tenure by plan */}
            <Card>
              <CardHeader>
                <CardTitle>Avg Tenure by Plan</CardTitle>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={planData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: AXIS, fontSize: 9, fontFamily: 'var(--font-dm-mono)' }}
                      axisLine={{ stroke: GRID }}
                      tickLine={false}
                      interval={0}
                      angle={-18}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis
                      tickFormatter={(v) => `${v}mo`}
                      tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(28,27,24,0.04)' }}
                      content={<ChartTooltip formatter={(v) => `${v} months`} />}
                    />
                    <Bar dataKey="tenure" name="Tenure" fill="#2A7A58" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            {/* LTV distribution */}
            <Card>
              <CardHeader>
                <CardTitle>LTV Distribution</CardTitle>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={a.distribution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                      dataKey="range"
                      tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
                      axisLine={{ stroke: GRID }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(28,27,24,0.04)' }}
                      content={<ChartTooltip formatter={(v) => `${v} customers`} />}
                    />
                    <Bar dataKey="count" name="Customers" fill="#C4A030" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            {/* Revenue concentration (Pareto) */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Revenue Concentration</CardTitle>
                <Badge tone="neutral">Pareto</Badge>
              </CardHeader>
              <CardBody>
                <ConcentrationBar label="Top 10% of customers" pct={a.concentration.top10} color="#3B6FA0" />
                <ConcentrationBar label="Top 20% of customers" pct={a.concentration.top20} color="#6B5EA8" />
                <p className="mt-3 text-xs leading-relaxed text-text-2">
                  Your most valuable {formatPercent(a.concentration.top20, 0)} of revenue comes from
                  the top 20% of members — protecting that group (onboarding, renewals) has the
                  highest revenue leverage.
                </p>
              </CardBody>
            </Card>

            {/* Upgrade timing */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Monthly → Annual: Timing</CardTitle>
                <Badge tone="neutral">months before upgrading</Badge>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={a.upgrade.timing} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
                      axisLine={{ stroke: GRID }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(28,27,24,0.04)' }}
                      content={<ChartTooltip formatter={(v) => `${v} upgrades`} />}
                    />
                    <Bar dataKey="count" name="Upgrades" fill="#A04878" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            {/* Upgrade calendar */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Monthly → Annual: When</CardTitle>
                <Badge tone="neutral">calendar month of upgrade</Badge>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={a.upgrade.calendar} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: AXIS, fontSize: 9, fontFamily: 'var(--font-dm-mono)' }}
                      axisLine={{ stroke: GRID }}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(28,27,24,0.04)' }}
                      content={<ChartTooltip formatter={(v) => `${v} upgrades`} />}
                    />
                    <Bar dataKey="count" name="Upgrades" radius={[3, 3, 0, 0]}>
                      {a.upgrade.calendar.map((d, i) => (
                        <Cell
                          key={i}
                          fill={['Jan', 'May', 'Aug'].includes(d.label) ? '#D07830' : '#C4A030'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-2 font-mono text-[10px] leading-snug text-text-3">
                  Upgrades cluster in January, May, and August — all campaign windows. Time annual
                  upgrade offers to these.
                </p>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </>
  )
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="font-mono text-[11px] uppercase tracking-wide text-text-3">{label}</div>
      <div className="mt-1.5 font-serif text-2xl text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-text-2">{sub}</div>}
    </Card>
  )
}

function ConcentrationBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-text-2">{label}</span>
        <span className="font-mono font-medium text-ink">{formatPercent(pct, 0)} of revenue</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-paper">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, pct * 100)}%`, background: color }}
        />
      </div>
    </div>
  )
}
