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
  type ProductRow,
} from '@/lib/products'
import { totalRevenue } from '@/lib/metrics'
import { PRODUCT_TYPE_LABELS, type ProductType } from '@/types'
import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils'

const GRID = 'rgba(28,27,24,0.07)'
const AXIS = '#9C9890'
type View = 'overview' | 'product' | 'collection'

export default function ProductsPage() {
  const { loading } = useOrdersMeta()
  const orders = useFilteredOrders()
  const compare = useCompareOrders()
  const { compareEnabled } = useDashboard()

  const [view, setView] = useState<View>('overview')

  const products = useMemo(() => productAggregates(orders), [orders])
  const categories = useMemo(() => categoryAggregates(orders), [orders])
  const names = useMemo(() => distinctProductNames(orders), [orders])
  const totalRev = useMemo(() => totalRevenue(orders.filter((o) => o.netSales > 0)), [orders])

  return (
    <>
      <PageHeader title="Products" description="Product sales across all stores — overview, by product, or by collection." />

      <div className="mb-5 flex flex-wrap gap-1 border-b border-border">
        {(
          [
            ['overview', 'Overview'],
            ['product', 'By Product'],
            ['collection', 'By Collection'],
          ] as [View, string][]
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={
              view === v
                ? 'relative -mb-px border-b-2 border-accent-blue px-3 py-2 text-sm font-medium text-ink'
                : 'px-3 py-2 text-sm text-text-2 hover:text-ink'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-96 animate-pulse rounded-lg border border-border bg-card" />
      ) : view === 'overview' ? (
        <OverviewView
          products={products}
          categories={categories}
          totalRev={totalRev}
          rev={totalRev}
          prevRev={compareEnabled && compare ? totalRevenue(compare) : undefined}
          orderCount={orders.length}
        />
      ) : view === 'product' ? (
        <ByProductView orders={orders} names={names} products={products} totalRev={totalRev} />
      ) : (
        <ByCollectionView categories={categories} products={products} totalRev={totalRev} />
      )}
    </>
  )
}

// ── Overview ───────────────────────────────────────────────────────
function OverviewView({
  products,
  categories,
  totalRev,
  rev,
  prevRev,
  orderCount,
}: {
  products: ProductRow[]
  categories: ReturnType<typeof categoryAggregates>
  totalRev: number
  rev: number
  prevRev?: number
  orderCount: number
}) {
  const [topN, setTopN] = useState<10 | 25>(10)
  const [metric, setMetric] = useState<'revenue' | 'units'>('revenue')
  const units = products.reduce((s, p) => s + p.units, 0)
  const aov = orderCount ? rev / orderCount : 0
  const ranked = [...products]
    .sort((a, b) => (metric === 'revenue' ? b.revenue - a.revenue : b.units - a.units))
    .slice(0, topN)
  const maxV = Math.max(1, ...ranked.map((p) => (metric === 'revenue' ? p.revenue : p.units)))
  const maxCat = Math.max(1, ...categories.map((c) => c.revenue))

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Product Revenue" value={rev} previous={prevRev} format="currency" />
        <KpiCard label="Units Sold" value={units} format="number" />
        <KpiCard label="Avg Order Value" value={aov} format="currency" info="aov" />
        <KpiCard label="Distinct Products" value={products.length} format="number" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Top Products</CardTitle>
            <div className="flex gap-1">
              <Segmented value={metric} onChange={(v) => setMetric(v as typeof metric)} options={[['revenue', 'Revenue'], ['units', 'Units']]} />
              <Segmented value={String(topN)} onChange={(v) => setTopN(Number(v) as 10 | 25)} options={[['10', 'Top 10'], ['25', 'Top 25']]} />
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            {ranked.map((p) => {
              const v = metric === 'revenue' ? p.revenue : p.units
              const share = totalRev ? p.revenue / totalRev : 0
              return (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate text-text-2" title={p.name}>{p.name}</span>
                    <span className="ml-2 shrink-0 font-mono tabular-nums text-ink">
                      {metric === 'revenue' ? formatCurrency(p.revenue) : formatNumber(p.units)}
                      <span className="ml-1 text-text-3">({formatPercent(share, 0)})</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper">
                    <div className="h-full rounded-full bg-accent-blue" style={{ width: `${(v / maxV) * 100}%` }} />
                  </div>
                </div>
              )
            })}
            {!ranked.length && <p className="text-sm text-text-3">No product sales in this period.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Revenue by Category</CardTitle></CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={280}>
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
    </>
  )
}

// ── By Product (search analyzer) ───────────────────────────────────
function ByProductView({
  orders,
  names,
  products,
  totalRev,
}: {
  orders: ReturnType<typeof useFilteredOrders>
  names: string[]
  products: ProductRow[]
  totalRev: number
}) {
  const [selected, setSelected] = useState<string[]>([])
  const trend = useMemo(() => monthlyRevenueForProducts(orders, selected, 12), [orders, selected])
  const rows = products.filter((p) => selected.includes(p.name))

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Analyze specific products</CardTitle>
        <Badge tone="neutral">{names.length.toLocaleString()} products available</Badge>
      </CardHeader>
      <CardBody>
        <ProductSelector names={names} selected={selected} onChange={setSelected} />
        {selected.length === 0 ? (
          <p className="mt-3 text-sm text-text-3">
            Start typing a product name above — matches appear as you type. Add as many as you
            like to chart and compare them.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend.map((p) => ({ label: p.label, ...p.values }))} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }} axisLine={{ stroke: GRID }} tickLine={false} />
                <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<ChartTooltip formatter={(v) => formatCurrency(Number(v))} />} />
                {selected.map((n, i) => (
                  <Line key={n} type="monotone" dataKey={n} name={n} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wide text-text-3">
                    <th className="py-1.5 pr-3 font-normal">Product</th>
                    <th className="py-1.5 pr-3 text-right font-normal">Revenue</th>
                    <th className="py-1.5 pr-3 text-right font-normal">Units</th>
                    <th className="py-1.5 pr-3 text-right font-normal">Avg price</th>
                    <th className="py-1.5 text-right font-normal">% of sales</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p, i) => (
                    <tr key={p.name} className="border-b border-border/60 last:border-0">
                      <td className="flex items-center gap-2 py-2 pr-3 text-ink">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                        <span className="truncate" title={p.name}>{p.name}</span>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatCurrency(p.revenue)}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatNumber(p.units)}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatCurrency(p.avgPrice)}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-text-2">
                        {formatPercent(totalRev ? p.revenue / totalRev : 0, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  )
}

// ── By Collection ──────────────────────────────────────────────────
function ByCollectionView({
  categories,
  products,
  totalRev,
}: {
  categories: ReturnType<typeof categoryAggregates>
  products: ProductRow[]
  totalRev: number
}) {
  const [collection, setCollection] = useState<ProductType | 'all'>('all')
  const rows = collection === 'all' ? products : products.filter((p) => p.productType === collection)
  const colRev = rows.reduce((s, p) => s + p.revenue, 0)
  const colUnits = rows.reduce((s, p) => s + p.units, 0)
  const top = [...rows].sort((a, b) => b.revenue - a.revenue).slice(0, 15)
  const maxV = Math.max(1, ...top.map((p) => p.revenue))

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wide text-text-3">Collection</span>
        <select
          value={collection}
          onChange={(e) => setCollection(e.target.value as ProductType | 'all')}
          className="rounded-md border border-border bg-white px-3 py-1.5 text-sm"
        >
          <option value="all">All collections</option>
          {categories.map((c) => (
            <option key={c.type} value={c.type}>{PRODUCT_TYPE_LABELS[c.type]}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Collection Revenue" value={colRev} format="currency" />
        <KpiCard label="Units" value={colUnits} format="number" />
        <KpiCard label="Products" value={rows.length} format="number" />
        <KpiCard label="% of All Sales" value={totalRev ? colRev / totalRev : 0} format="percent" />
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Products in this collection</CardTitle></CardHeader>
        <CardBody className="space-y-2">
          {top.map((p) => (
            <div key={p.name}>
              <div className="flex items-center justify-between text-xs">
                <span className="truncate text-text-2" title={p.name}>{p.name}</span>
                <span className="ml-2 font-mono tabular-nums text-ink">{formatCurrency(p.revenue)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper">
                <div className="h-full rounded-full bg-accent-blue" style={{ width: `${(p.revenue / maxV) * 100}%` }} />
              </div>
            </div>
          ))}
          {!top.length && <p className="text-sm text-text-3">No products in this collection for the period.</p>}
        </CardBody>
      </Card>

      <p className="mt-3 text-xs text-text-3">
        “Collections” currently use the product categories we derive from order data. Once we pull
        true Shopify collections, they’ll appear here automatically.
      </p>
    </>
  )
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn('rounded px-2 py-1', value === v ? 'bg-ink text-white' : 'text-text-2')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
