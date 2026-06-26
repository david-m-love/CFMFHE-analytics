'use client'

import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { KpiCard } from '@/components/kpi-card'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChartTooltip } from '@/components/charts/ChartTooltip'
import {
  useCompareOrders,
  useFilteredOrders,
  useOrdersMeta,
  useStoreOrders,
} from '@/lib/use-orders'
import { useDashboard } from '@/store/dashboard'
import {
  estimatedActiveMembers,
  estimatedMrr,
  membershipRevenue,
  monthlyAcquisition,
  monthlyMemberSplit,
  monthlyPriceSplit,
  monthlyRevenueByPlan,
  newMemberRevenue,
  newMembers,
  planBreakdown,
  returningMemberRevenue,
  returningMembers,
} from '@/lib/metrics'
import { getLtvAnalysis } from '@/lib/ltv'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { ProductType } from '@/types'

const GRID = 'rgba(28,27,24,0.07)'
const AXIS = '#9C9890'
const PLAN_COLORS: Record<string, string> = {
  digital_monthly: '#3B6FA0',
  digital_yearly: '#6B5EA8',
  digital_semiannual: '#2A7A58',
  digital_quarterly: '#C4A030',
  workbook_monthly: '#D07830',
  workbook_only: '#A04878',
}

export function MembershipOverview() {
  const { loading, status } = useOrdersMeta()
  const filtered = useFilteredOrders()
  const compare = useCompareOrders()
  const storeOrders = useStoreOrders()
  const { compareEnabled } = useDashboard()
  const cmp = compareEnabled ? compare : null

  const breakdown = useMemo(() => planBreakdown(filtered), [filtered])
  const revByPlan = useMemo(() => monthlyRevenueByPlan(storeOrders, 12), [storeOrders])
  const priceSplit = useMemo(() => monthlyPriceSplit(storeOrders, 12), [storeOrders])
  const acquisition = useMemo(() => monthlyAcquisition(storeOrders, 12), [storeOrders])
  const memberSplit = useMemo(() => monthlyMemberSplit(storeOrders, 12), [storeOrders])

  const annualMembers = useMemo(() => {
    const set = new Set(
      filtered
        .filter((o) => o.productType === 'digital_yearly' && o.netSales > 0)
        .map((o) => o.customerName),
    )
    return set.size
  }, [filtered])
  const upgradePct = useMemo(() => getLtvAnalysis(storeOrders, status).upgrade.pctFromMonthly, [storeOrders, status])
  const upgraded = Math.round(annualMembers * upgradePct)
  const direct = Math.max(0, annualMembers - upgraded)

  const areaData = useMemo(
    () => revByPlan.points.map((p) => ({ label: p.label, ...p.values })),
    [revByPlan],
  )

  if (loading) {
    return <div className="h-96 animate-pulse rounded-lg border border-border bg-card" />
  }

  return (
    <div>
      {/* KPIs — lead with revenue; member count secondary. New + Returning sum to Total. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Total Membership"
          value={membershipRevenue(filtered)}
          previous={cmp ? membershipRevenue(cmp) : undefined}
          format="currency"
          info="activeMembers"
          secondaryValue={estimatedActiveMembers(filtered)}
          secondaryFormat="number"
          secondaryLabel="members"
        />
        <KpiCard
          label="New Members"
          value={newMemberRevenue(filtered)}
          previous={cmp ? newMemberRevenue(cmp) : undefined}
          format="currency"
          secondaryValue={newMembers(filtered)}
          secondaryFormat="number"
          secondaryLabel="new"
        />
        <KpiCard
          label="Returning Members"
          value={returningMemberRevenue(filtered)}
          previous={cmp ? returningMemberRevenue(cmp) : undefined}
          format="currency"
          secondaryValue={returningMembers(filtered)}
          secondaryFormat="number"
          secondaryLabel="returning"
        />
        <KpiCard
          label="MRR"
          value={estimatedMrr(filtered)}
          previous={cmp ? estimatedMrr(cmp) : undefined}
          format="currency"
          info="mrr"
        />
      </div>

      {/* Plan breakdown */}
      <Card className="mt-4">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Members & MRR by Plan</CardTitle>
          <Badge tone="neutral">selected period</Badge>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wide text-text-3">
                <th className="py-1.5 pr-3 font-normal">Plan</th>
                <th className="py-1.5 pr-3 text-right font-normal">Members</th>
                <th className="py-1.5 pr-3 text-right font-normal">MRR</th>
                <th className="py-1.5 text-right font-normal">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((r) => (
                <tr key={r.type} className="border-b border-border/60 last:border-0">
                  <td className="flex items-center gap-2 py-2 pr-3 text-ink">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: PLAN_COLORS[r.type] }}
                    />
                    {r.label}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-ink">
                    {formatNumber(r.members)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-ink">
                    {formatCurrency(r.mrr)}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-text-2">
                    {formatCurrency(r.revenue)}
                  </td>
                </tr>
              ))}
              {!breakdown.length && (
                <tr>
                  <td colSpan={4} className="py-3 text-text-3">
                    No membership orders in the selected range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="mt-2 font-mono text-[10px] text-text-3">
            Refund rate by plan needs refund data (not in the current order export).
          </p>
        </CardBody>
      </Card>

      {/* Charts */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>New vs Returning Members</CardTitle>
            <Badge tone="neutral">12 months · by month</Badge>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={memberSplit} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }} axisLine={{ stroke: GRID }} tickLine={false} />
                <YAxis tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip cursor={{ fill: 'rgba(28,27,24,0.04)' }} content={<ChartTooltip />} />
                <Bar dataKey="newMembers" name="New" stackId="m" fill="#3B6FA0" />
                <Bar dataKey="returningMembers" name="Returning" stackId="m" fill="#6B5EA8" radius={[3, 3, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Revenue by Plan</CardTitle>
            <Badge tone="neutral">12 months</Badge>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={areaData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => formatCurrency(v, { compact: true })}
                  tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip content={<ChartTooltip formatter={(v) => formatCurrency(Number(v))} />} />
                {revByPlan.plans.map((p) => (
                  <Area
                    key={p.type}
                    type="monotone"
                    dataKey={p.type as ProductType}
                    name={p.label}
                    stackId="r"
                    stroke={PLAN_COLORS[p.type]}
                    fill={PLAN_COLORS[p.type]}
                    fillOpacity={0.85}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>$10 vs $12 Monthly Members</CardTitle>
            <Badge tone="neutral">grandfathered crossover</Badge>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={priceSplit} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="p10" name="$10 (grandfathered)" stroke="#9C9890" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="p12" name="$12 (current)" stroke="#3B6FA0" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>New Member Acquisition</CardTitle>
            <Badge tone="neutral">monthly · 3-mo avg</Badge>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={acquisition} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                <Tooltip cursor={{ fill: 'rgba(28,27,24,0.04)' }} content={<ChartTooltip />} />
                <Bar dataKey="newMembers" name="New members" radius={[3, 3, 0, 0]}>
                  {acquisition.map((d) => (
                    <Cell key={d.month} fill="#2A7A58" fillOpacity={d.isJanuary ? 0.55 : 1} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="rolling" name="3-mo avg" stroke="#1C1B18" strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="mt-2 font-mono text-[10px] text-text-3">
              Faded bars = January (seasonally elevated New Year campaign).
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Annual Buyers: Direct vs Upgraded</CardTitle>
          </CardHeader>
          <CardBody>
            {annualMembers > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={150} height={150}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Upgraded from monthly', value: upgraded },
                        { name: 'Direct to annual', value: direct },
                      ]}
                      dataKey="value"
                      innerRadius={44}
                      outerRadius={68}
                      paddingAngle={2}
                      stroke="none"
                    >
                      <Cell fill="#6B5EA8" />
                      <Cell fill="#C4A030" />
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2 text-text-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#6B5EA8]" />
                    Upgraded from monthly
                    <span className="ml-auto font-mono text-ink">{upgraded}</span>
                  </li>
                  <li className="flex items-center gap-2 text-text-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#C4A030]" />
                    Direct to annual
                    <span className="ml-auto font-mono text-ink">{direct}</span>
                  </li>
                  <li className="pt-1 text-xs text-text-3">
                    {Math.round(upgradePct * 100)}% of annual members started on a monthly plan.
                  </li>
                </ul>
              </div>
            ) : (
              <p className="text-sm text-text-3">No annual members in the selected range.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
