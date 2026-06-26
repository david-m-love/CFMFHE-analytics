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
import { KpiCard } from '@/components/kpi-card'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChartTooltip } from '@/components/charts/ChartTooltip'
import { ProductSelector, SERIES_COLORS } from '@/components/products/ProductSelector'
import { useCompareOrders, useFilteredOrders, useOrdersMeta } from '@/lib/use-orders'
import { useDashboard } from '@/store/dashboard'
import {
  categoryAggregates,
  distinctProductNames,
  monthlyRevenueForProducts,
  productAggregates,
} from '@/lib/products'
import { totalRevenue } from '@/lib/metrics'
import { PRODUCT_TYPE_LABELS, type ProductType } from '@/types'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'

const GRID = 'rgba(28,27,24,0.07)'
const AXIS = '#9C9890'

export default function ProductsPage() {
  const { loading } = useOrdersMeta()
  const allFiltered = useFilteredOrders()
  const compare = useCompareOrders()
  const { compareEnabled } = useDashboard()

  const [activeTypes, setActiveTypes] = useState<ProductType[] | null>(null) // null = all
  const [metric, setMetric] = useState<'revenue' | 'units'>('revenue')
  const [selected, setSelected] = useState<string[]>([])

  // categories present in the data
  const categories = useMemo(() => categoryAggregates(allFiltered), [allFiltered])
  const typeFilter = (orders: typeof allFiltered) =>
    activeTypes ? orders.filter((o) => activeTypes.includes(o.productType)) : orders

  const scoped = useMemo(() => typeFilter(allFiltered), [allFiltered, activeTypes])
  const scopedCompare = useMemo(
    () => (compare ? typeFilter(compare) : null),
    [compare, activeTypes],
  )

  const products = useMemo(() => productAggregates(scoped), [scoped])
  const names = useMemo(() => distinctProductNames(allFiltered), [allFiltered])
  const trend = useMemo(
    () => monthlyRevenueForProducts(allFiltered, selected, 12),
    [allFiltered, selected],
  )

  const rev = totalRevenue(scoped)
  const prevRev = scopedCompare ? totalRevenue(scopedCompare) : undefined
  const totalUnits = products.reduce((s, p) => s + p.units, 0)
  const orderCount = scoped.length
  const aov = orderCount ? rev / orderCount : 0
  const topByRev = products[0]
  const topByUnits = [...products].sort((a, b) => b.units - a.units)[0]
  const ranked = [...products].sort((a, b) => (metric === 'revenue' ? b.revenue - a.revenue : b.units - a.units)).slice(0, 10)
  const maxRanked = Math.max(1, ...ranked.map((p) => (metric === 'revenue' ? p.revenue : p.units)))
  const maxCat = Math.max(1, ...categories.map((c) => c.revenue))

  function toggleType(t: ProductType) {
    const present = categories.map((c) => c.type)
    const current = activeTypes ?? present
    const next = current.includes(t) ? current.filter((x) => x !== t) : [...current, t]
    setActiveTypes(next.length === present.length ? null : next)
  }
  const isTypeOn = (t: ProductType) => !activeTypes || activeTypes.includes(t)

  return (
    <>
      <PageHeader title="Products" description="Product sales, units, and category performance across all stores." />

      {/* Category / type filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c.type}
            onClick={() => toggleType(c.type)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              isTypeOn(c.type)
                ? 'border-accent-blue bg-[#eaf0f6] text-accent-blue'
                : 'border-border text-text-3',
            )}
          >
            {PRODUCT_TYPE_LABELS[c.type]}
          </button>
        ))}
        {activeTypes && (
          <button onClick={() => setActiveTypes(null)} className="px-2 text-xs text-text-3 hover:text-ink">
            reset
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-96 animate-pulse rounded-lg border border-border bg-card" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Product Revenue" value={rev} previous={compareEnabled ? prevRev : undefined} format="currency" />
            <KpiCard label="Units Sold" value={totalUnits} format="number" />
            <KpiCard label="Avg Order Value" value={aov} format="currency" info="aov" />
            <Card className="p-4">
              <div className="font-mono text-[11px] uppercase tracking-wide text-text-3">Top Product</div>
              <div className="mt-1.5 truncate font-serif text-lg text-ink" title={topByRev?.name}>
                {topByRev?.name ?? '—'}
              </div>
              <div className="mt-0.5 text-xs text-text-2">
                {topByRev ? formatCurrency(topByRev.revenue) : ''}
              </div>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Top products */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Top Products</CardTitle>
                <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
                  {(['revenue', 'units'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetric(m)}
                      className={cn('rounded px-2 py-1 capitalize', metric === m ? 'bg-ink text-white' : 'text-text-2')}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardBody className="space-y-2">
                {ranked.map((p) => {
                  const v = metric === 'revenue' ? p.revenue : p.units
                  return (
                    <div key={p.name}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate text-text-2" title={p.name}>{p.name}</span>
                        <span className="ml-2 font-mono tabular-nums text-ink">
                          {metric === 'revenue' ? formatCurrency(p.revenue) : formatNumber(p.units)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper">
                        <div className="h-full rounded-full bg-accent-blue" style={{ width: `${(v / maxRanked) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
                {!ranked.length && <p className="text-sm text-text-3">No products in this selection.</p>}
              </CardBody>
            </Card>

            {/* Category breakdown */}
            <Card>
              <CardHeader><CardTitle>Revenue by Category</CardTitle></CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={categories} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => formatCurrency(v, { compact: true })} tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="label" width={96} tick={{ fill: AXIS, fontSize: 9, fontFamily: 'var(--font-dm-mono)' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(28,27,24,0.04)' }} content={<ChartTooltip formatter={(v) => formatCurrency(Number(v))} />} />
                    <Bar dataKey="revenue" name="Revenue" radius={[0, 3, 3, 0]}>
                      {categories.map((c) => (
                        <Cell key={c.type} fill={c.revenue === maxCat ? '#3B6FA0' : '#9CB3C9'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </div>

          {/* Product comparison selector */}
          <Card className="mt-4">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Compare Specific Products</CardTitle>
              <Badge tone="neutral">12-month revenue</Badge>
            </CardHeader>
            <CardBody>
              <ProductSelector names={names} selected={selected} onChange={setSelected} />
              {selected.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart
                    data={trend.map((p) => ({ label: p.label, ...p.values }))}
                    margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }} axisLine={{ stroke: GRID }} tickLine={false} />
                    <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<ChartTooltip formatter={(v) => formatCurrency(Number(v))} />} />
                    {selected.map((n, i) => (
                      <Line key={n} type="monotone" dataKey={n} name={n} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="mt-3 text-sm text-text-3">
                  Search for products above to chart and compare them side by side.
                </p>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </>
  )
}
