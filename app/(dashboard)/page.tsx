'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { PageHeader } from '@/components/page-header'
import { KpiCard } from '@/components/kpi-card'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RevenueChart } from '@/components/charts/RevenueChart'
import {
  useCompareOrders,
  useFilteredOrders,
  useOrdersMeta,
  useStoreOrders,
} from '@/lib/use-orders'
import { useDashboard } from '@/store/dashboard'
import { monthlyRevenue, totalRevenue } from '@/lib/metrics'
import { businessNewVsReturning } from '@/lib/identity'
import { STORE_LABELS, type StoreSource } from '@/types'
import { JANUARY_ANOMALY_NOTE } from '@/lib/config'
import { formatCurrency, formatPercent } from '@/lib/utils'

const STORE_COLORS: Record<StoreSource, string> = { cfmfhe: '#3B6FA0', ec: '#2A7A58' }

export default function OverviewPage() {
  const { loading } = useOrdersMeta()
  const filtered = useFilteredOrders()
  const compare = useCompareOrders()
  const allOrders = useStoreOrders()
  const { range, compareEnabled, compareRange } = useDashboard()
  const cmp = compareEnabled ? compare : null

  const revData = useMemo(() => monthlyRevenue(allOrders, 12), [allOrders])
  const nvr = useMemo(
    () => businessNewVsReturning(allOrders, range.from, range.to),
    [allOrders, range.from, range.to],
  )
  const nvrCmp = useMemo(
    () =>
      compareEnabled && compareRange
        ? businessNewVsReturning(allOrders, compareRange.from, compareRange.to)
        : null,
    [allOrders, compareEnabled, compareRange],
  )

  const sales = totalRevenue(filtered)
  const orders = filtered.filter((o) => o.netSales > 0).length
  const aov = orders ? sales / orders : 0

  const byStore = useMemo(() => {
    const stores = Object.keys(STORE_LABELS) as StoreSource[]
    const rows = stores.map((s) => ({
      source: s,
      label: STORE_LABELS[s],
      revenue: filtered.filter((o) => o.source === s && o.netSales > 0).reduce((t, o) => t + o.netSales, 0),
    }))
    const total = rows.reduce((t, r) => t + r.revenue, 0) || 1
    return rows.map((r) => ({ ...r, pct: r.revenue / total }))
  }, [filtered])

  return (
    <>
      <PageHeader
        title="Overview"
        description="Whole-business sales and customers across all stores."
      />

      {loading ? (
        <LoadingGrid />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <KpiCard label="Total Sales" value={sales} previous={cmp ? totalRevenue(cmp) : undefined} format="currency" />
            <KpiCard label="Orders" value={orders} previous={cmp ? cmp.filter((o) => o.netSales > 0).length : undefined} format="number" />
            <KpiCard label="Avg Order Value" value={aov} format="currency" info="aov" />
            <KpiCard
              label="New Customers"
              value={nvr.newCustomers}
              previous={nvrCmp?.newCustomers}
              format="number"
              info="newVsReturning"
              secondaryValue={nvr.newRevenue}
              secondaryFormat="currency"
            />
            <KpiCard
              label="Returning Customers"
              value={nvr.returningCustomers}
              previous={nvrCmp?.returningCustomers}
              format="number"
              secondaryValue={nvr.returningRevenue}
              secondaryFormat="currency"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Sales Over Time</CardTitle>
                <Badge tone="neutral">12 months · new vs returning</Badge>
              </CardHeader>
              <CardBody>
                <RevenueChart data={revData} />
                <p className="mt-2 font-mono text-[10px] leading-snug text-text-3">
                  <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-accent-blue/55 align-middle" />
                  {JANUARY_ANOMALY_NOTE}
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>Sales by Store</CardTitle></CardHeader>
              <CardBody className="space-y-3 pt-2">
                {byStore.map((r) => (
                  <div key={r.source}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-text-2">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STORE_COLORS[r.source] }} />
                        {r.label}
                      </span>
                      <span className="font-mono tabular-nums text-ink">{formatCurrency(r.revenue)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper">
                      <div className="h-full rounded-full" style={{ width: `${r.pct * 100}%`, background: STORE_COLORS[r.source] }} />
                    </div>
                    <div className="mt-0.5 text-right font-mono text-[10px] text-text-3">{formatPercent(r.pct, 0)}</div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>

          {/* Marketing teaser — becomes the CMO view once ad accounts connect */}
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-text-3">
              Marketing
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                ['Total Ad Spend', 'roas'],
                ['Blended ROAS', 'roas'],
                ['New-Customer CAC', 'cac'],
              ].map(([label]) => (
                <Card key={label} className="p-4">
                  <div className="font-mono text-[11px] uppercase tracking-wide text-text-3">{label}</div>
                  <div className="mt-1.5 font-mono text-2xl text-text-3">—</div>
                  <Link href="/cmo" className="mt-1 inline-block text-xs text-accent-blue hover:underline">
                    Open CMO dashboard →
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-card" />
      ))}
    </div>
  )
}
