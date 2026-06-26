'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Settings2, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { KpiCard } from '@/components/kpi-card'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InfoTip } from '@/components/info-tip'
import { useFilteredOrders, useOrdersMeta, useStoreOrders } from '@/lib/use-orders'
import { useDashboard } from '@/store/dashboard'
import { distinctProductNames } from '@/lib/products'
import {
  computeCmo,
  productUnitEconomics,
  DEFAULT_CMO_SETTINGS,
  type CmoSettings,
} from '@/lib/marketing'
import {
  AD_SOURCE_LABELS,
  adSpendByProduct,
  resolveCampaignProducts,
  type AdCampaign,
  type AdSource,
  type AdSpendData,
  type CampaignMap,
} from '@/lib/campaign-mapping'
import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils'

const EMPTY_ADS: AdSpendData = { total: 0, bySource: { meta: 0, google_ads: 0 }, campaigns: [] }

export default function CmoPage() {
  const { loading } = useOrdersMeta()
  const filtered = useFilteredOrders()
  const allOrders = useStoreOrders()
  const { range } = useDashboard()
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin' || !session

  const [settings, setSettings] = useState<CmoSettings>(DEFAULT_CMO_SETTINGS)
  const [editing, setEditing] = useState(false)
  const [ads, setAds] = useState<AdSpendData>(EMPTY_ADS)
  const [adsNote, setAdsNote] = useState<string | undefined>()
  const [map, setMap] = useState<CampaignMap>({})
  const [mapping, setMapping] = useState(false)

  useEffect(() => {
    fetch('/api/settings/cmo', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => d?.settings && setSettings(d.settings))
      .catch(() => {})
    fetch('/api/settings/campaign-map', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => d?.map && setMap(d.map))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`/api/marketing/ads?from=${range.from}&to=${range.to}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.data) setAds(d.data)
        setAdsNote(d?.note)
      })
      .catch(() => {})
  }, [range.from, range.to])

  const productNames = useMemo(() => distinctProductNames(filtered), [filtered])
  const spendByProduct = useMemo(
    () => adSpendByProduct(ads.campaigns, map, productNames),
    [ads.campaigns, map, productNames],
  )

  const m = useMemo(
    () => computeCmo(filtered, allOrders, range.from, range.to, settings, ads.total),
    [filtered, allOrders, range.from, range.to, settings, ads.total],
  )

  const econ = useMemo(
    () => productUnitEconomics(filtered, settings, spendByProduct),
    [filtered, settings, spendByProduct],
  )

  return (
    <>
      <PageHeader
        title="CMO"
        description="Marketing efficiency: ad spend, ROAS, acquisition cost, and contribution margin."
        showSource={false}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {adsNote && <p className="text-xs text-text-2">{adsNote}</p>}
        <div className="ml-auto flex gap-2">
          {isAdmin && ads.campaigns.length > 0 && (
            <Button variant="outline" onClick={() => setMapping((v) => !v)}>
              {mapping ? 'Close mapping' : 'Map campaigns'}
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={() => setEditing((e) => !e)}>
              <Settings2 size={14} /> {editing ? 'Close' : 'Assumptions'}
            </Button>
          )}
        </div>
      </div>

      {editing && isAdmin && (
        <AssumptionsEditor settings={settings} onSaved={(s) => { setSettings(s); setEditing(false) }} onCancel={() => setEditing(false)} />
      )}

      {mapping && isAdmin && (
        <CampaignMappingEditor
          campaigns={ads.campaigns}
          map={map}
          productNames={productNames}
          onSaved={(next) => { setMap(next); setMapping(false) }}
          onCancel={() => setMapping(false)}
        />
      )}

      {loading ? (
        <div className="h-40 animate-pulse rounded-lg border border-border bg-card" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Total Sales" value={m.revenue} format="currency" />
            <KpiCard label="Ad Spend" value={m.adSpend} format="currency" goodWhen="down" hint={m.adSpend <= 0 ? 'not set' : 'this period'} />
            <MetricCard label="Blended ROAS" info="roas" value={m.roas != null ? `${m.roas.toFixed(2)}×` : '—'} />
            <MetricCard label="NC-ROAS" info="ncRoas" value={m.ncRoas != null ? `${m.ncRoas.toFixed(2)}×` : '—'} />
            <MetricCard label="New-Customer CAC" info="cac" value={m.cac != null ? formatCurrency(m.cac) : '—'} />
            <KpiCard
              label="Contribution Margin"
              value={m.contributionMargin}
              format="currency"
              info="contributionMargin"
              secondaryValue={m.contributionMarginPct}
              secondaryFormat="percent"
            />
            <KpiCard
              label="New Customers"
              value={m.newCustomers}
              format="number"
              info="newVsReturning"
              secondaryValue={m.newRevenue}
              secondaryFormat="currency"
            />
            <KpiCard label="Returning Customers" value={m.returningCustomers} format="number" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <AdSpendBreakdown ads={ads} />
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Contribution Margin Breakdown</CardTitle></CardHeader>
              <CardBody>
                <Waterfall
                  rows={[
                    { label: 'Revenue', value: m.revenue, kind: 'pos' },
                    { label: 'COGS (modeled)', value: -m.cogs, kind: 'neg' },
                    { label: 'Shipping (est.)', value: -m.shipping, kind: 'neg' },
                    { label: 'Ad spend', value: -m.adSpend, kind: 'neg' },
                    { label: 'Contribution margin', value: m.contributionMargin, kind: 'total' },
                  ]}
                />
                <p className="mt-2 font-mono text-[10px] text-text-3">
                  COGS modeled at {formatPercent(settings.cogsDefaultPct, 0)} default
                  {settings.cogsOverrides.length ? ` (+${settings.cogsOverrides.length} product overrides)` : ''};
                  shipping {formatCurrency(settings.shippingPerOrder)}/order. Adjust under Assumptions.
                </p>
              </CardBody>
            </Card>
          </div>

          <ProductEconomicsTable rows={econ} hasSpend={ads.total > 0} />
        </>
      )}
    </>
  )
}

function MetricCard({ label, value, info }: { label: string; value: string; info?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-text-3">
        {label}
        {info && <InfoTip term={info} />}
      </div>
      <div className="mt-1.5 font-mono text-2xl font-medium text-ink tabular-nums">{value}</div>
    </Card>
  )
}

const SOURCE_COLORS: Record<AdSource, string> = { meta: '#3B6FA0', google_ads: '#B87020' }

function AdSpendBreakdown({ ads }: { ads: AdSpendData }) {
  const sources = (Object.keys(AD_SOURCE_LABELS) as AdSource[]).map((s) => ({
    source: s,
    label: AD_SOURCE_LABELS[s],
    spend: ads.bySource[s] ?? 0,
  }))
  const total = ads.total || 1
  return (
    <Card>
      <CardHeader><CardTitle>Ad Spend by Source</CardTitle></CardHeader>
      <CardBody className="space-y-3 pt-2">
        {sources.map((r) => (
          <div key={r.source}>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-text-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SOURCE_COLORS[r.source] }} />
                {r.label}
              </span>
              <span className="font-mono tabular-nums text-ink">{formatCurrency(r.spend)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper">
              <div className="h-full rounded-full" style={{ width: `${(r.spend / total) * 100}%`, background: SOURCE_COLORS[r.source] }} />
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
          <span className="font-medium text-ink">Total ad spend</span>
          <span className="font-mono tabular-nums font-medium text-ink">{formatCurrency(ads.total)}</span>
        </div>
      </CardBody>
    </Card>
  )
}

const UNASSIGNED = '__unassigned__'

function CampaignMappingEditor({
  campaigns,
  map,
  productNames,
  onSaved,
  onCancel,
}: {
  campaigns: AdCampaign[]
  map: CampaignMap
  productNames: string[]
  onSaved: (m: CampaignMap) => void
  onCancel: () => void
}) {
  const suggestions = useMemo(
    () => resolveCampaignProducts(campaigns, {}, productNames),
    [campaigns, productNames],
  )
  // initial selection: explicit map first, else suggestion
  const [sel, setSel] = useState<Record<string, string>>(() => {
    const s: Record<string, string> = {}
    for (const c of campaigns) s[c.id] = map[c.id] ?? suggestions[c.id] ?? UNASSIGNED
    return s
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    const next: CampaignMap = {}
    for (const [id, product] of Object.entries(sel)) {
      if (product && product !== UNASSIGNED) next[id] = product
    }
    const res = await fetch('/api/settings/campaign-map', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ map: next }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data.error ?? 'Could not save.')
      return
    }
    onSaved(data.map)
  }

  return (
    <Card className="mb-4">
      <CardHeader><CardTitle>Map campaigns to products</CardTitle></CardHeader>
      <CardBody className="space-y-3">
        <p className="text-xs text-text-2">
          Assign each ad campaign to the product it sells so we can compute per-product ROAS.
          We pre-fill a suggested match from the campaign name — adjust any that look wrong.
        </p>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wide text-text-3">
                <th className="px-1 py-1.5">Campaign</th>
                <th className="px-1 py-1.5">Spend</th>
                <th className="px-1 py-1.5">Product</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const suggested = suggestions[c.id]
                const isSuggested = sel[c.id] === suggested && suggested != null
                return (
                  <tr key={c.id} className="border-b border-border/60">
                    <td className="px-1 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: SOURCE_COLORS[c.source] }} />
                        <span className="text-ink">{c.name}</span>
                        {c.status === 'paused' && <Badge tone="neutral">paused</Badge>}
                      </div>
                    </td>
                    <td className="px-1 py-2 font-mono tabular-nums text-text-2">{formatCurrency(c.spend)}</td>
                    <td className="px-1 py-2">
                      <select
                        value={sel[c.id] ?? UNASSIGNED}
                        onChange={(e) => setSel((p) => ({ ...p, [c.id]: e.target.value }))}
                        className="w-full max-w-[260px] rounded-md border border-border bg-white px-2 py-1.5 text-sm outline-none focus:border-accent-blue"
                      >
                        <option value={UNASSIGNED}>— Unassigned —</option>
                        {productNames.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      {isSuggested && <span className="ml-1 font-mono text-[10px] text-accent-green">suggested</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {error && <p className="text-xs text-accent-red">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md px-3 py-2 text-sm text-text-2 hover:bg-paper">Cancel</button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save mapping'}</Button>
        </div>
      </CardBody>
    </Card>
  )
}

function ProductEconomicsTable({
  rows,
  hasSpend,
}: {
  rows: ReturnType<typeof productUnitEconomics>
  hasSpend: boolean
}) {
  const top = rows.slice(0, 15)
  return (
    <Card className="mt-4">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Per-Product Unit Economics</CardTitle>
        <InfoTip term="contributionMargin" />
      </CardHeader>
      <CardBody>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wide text-text-3">
                <th className="px-2 py-1.5">Product</th>
                <th className="px-2 py-1.5 text-right">Revenue</th>
                <th className="px-2 py-1.5 text-right">Ad spend</th>
                <th className="px-2 py-1.5 text-right">ROAS</th>
                <th className="px-2 py-1.5 text-right">Contribution</th>
                <th className="px-2 py-1.5 text-right">CM %</th>
              </tr>
            </thead>
            <tbody>
              {top.map((r) => (
                <tr key={r.name} className="border-b border-border/60">
                  <td className="px-2 py-2 text-ink">{r.name}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-ink">{formatCurrency(r.revenue)}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-text-2">{r.adSpend > 0 ? formatCurrency(r.adSpend) : '—'}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-ink">{r.roas != null ? `${r.roas.toFixed(2)}×` : '—'}</td>
                  <td className={cn('px-2 py-2 text-right font-mono tabular-nums', r.contributionMargin < 0 ? 'text-accent-red' : 'text-ink')}>
                    {formatCurrency(r.contributionMargin)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-text-2">{formatPercent(r.contributionMarginPct, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 font-mono text-[10px] leading-snug text-text-3">
          Revenue attributed to each order&rsquo;s primary product; {formatNumber(top.length)} of {formatNumber(rows.length)} products shown.
          {!hasSpend && ' Connect Meta or Google Ads (and map campaigns) to populate per-product ROAS.'}
        </p>
      </CardBody>
    </Card>
  )
}

function Waterfall({ rows }: { rows: { label: string; value: number; kind: 'pos' | 'neg' | 'total' }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)))
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-2">{r.label}</span>
            <span className={cn('font-mono tabular-nums', r.kind === 'neg' ? 'text-accent-red' : 'text-ink')}>
              {r.value < 0 ? '−' : ''}{formatCurrency(Math.abs(r.value))}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper">
            <div
              className={cn('h-full rounded-full', r.kind === 'neg' ? 'bg-accent-red' : r.kind === 'total' ? 'bg-accent-green' : 'bg-accent-blue')}
              style={{ width: `${(Math.abs(r.value) / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function AssumptionsEditor({
  settings,
  onSaved,
  onCancel,
}: {
  settings: CmoSettings
  onSaved: (s: CmoSettings) => void
  onCancel: () => void
}) {
  const [cogsPct, setCogsPct] = useState(String(Math.round(settings.cogsDefaultPct * 100)))
  const [shipping, setShipping] = useState(String(settings.shippingPerOrder))
  const [overrides, setOverrides] = useState(
    settings.cogsOverrides.map((o) => ({ name: o.name, pct: String(Math.round(o.pct * 100)) })),
  )
  const [spend, setSpend] = useState(settings.manualAdSpend.map((m) => ({ ...m, amount: String(m.amount) })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    const payload: CmoSettings = {
      cogsDefaultPct: (Number(cogsPct) || 0) / 100,
      shippingPerOrder: Number(shipping) || 0,
      cogsOverrides: overrides.filter((o) => o.name.trim()).map((o) => ({ name: o.name.trim(), pct: (Number(o.pct) || 0) / 100 })),
      manualAdSpend: spend.filter((s) => /^\d{4}-\d{2}$/.test(s.month)).map((s) => ({ month: s.month, amount: Number(s.amount) || 0 })),
    }
    const res = await fetch('/api/settings/cmo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data.error ?? 'Could not save.')
      return
    }
    onSaved(data.settings)
  }

  return (
    <Card className="mb-4">
      <CardHeader><CardTitle>Assumptions</CardTitle></CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Default COGS %" value={cogsPct} onChange={setCogsPct} suffix="%" />
          <Field label="Shipping per order" value={shipping} onChange={setShipping} prefix="$" />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-text-2">Per-product COGS overrides</span>
            <button onClick={() => setOverrides([...overrides, { name: '', pct: '' }])} className="inline-flex items-center gap-1 text-xs text-accent-blue">
              <Plus size={12} /> Add
            </button>
          </div>
          {overrides.map((o, i) => (
            <div key={i} className="mb-1 flex items-center gap-2">
              <input value={o.name} onChange={(e) => setOverrides(overrides.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Product name" className="flex-1 rounded-md border border-border px-2 py-1 text-sm" />
              <input value={o.pct} onChange={(e) => setOverrides(overrides.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))} placeholder="%" className="w-16 rounded-md border border-border px-2 py-1 text-sm" />
              <button onClick={() => setOverrides(overrides.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={13} className="text-text-3 hover:text-accent-red" /></button>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-text-2">Manual ad spend (supplements connected ad accounts)</span>
            <button onClick={() => setSpend([...spend, { month: '', amount: '' }])} className="inline-flex items-center gap-1 text-xs text-accent-blue">
              <Plus size={12} /> Add month
            </button>
          </div>
          {spend.map((s, i) => (
            <div key={i} className="mb-1 flex items-center gap-2">
              <input type="month" value={s.month} onChange={(e) => setSpend(spend.map((x, j) => (j === i ? { ...x, month: e.target.value } : x)))} className="rounded-md border border-border px-2 py-1 text-sm" />
              <input value={s.amount} onChange={(e) => setSpend(spend.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} placeholder="$ spend" className="w-28 rounded-md border border-border px-2 py-1 text-sm" />
              <button onClick={() => setSpend(spend.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={13} className="text-text-3 hover:text-accent-red" /></button>
            </div>
          ))}
          <p className="mt-1 text-[11px] text-text-3">Connect Meta &amp; Google Ads under Connections to pull spend automatically; manual entry here adds any channels not connected (e.g. Etsy).</p>
        </div>

        {error && <p className="text-xs text-accent-red">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md px-3 py-2 text-sm text-text-2 hover:bg-paper">Cancel</button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save assumptions'}</Button>
        </div>
      </CardBody>
    </Card>
  )
}

function Field({ label, value, onChange, prefix, suffix }: { label: string; value: string; onChange: (v: string) => void; prefix?: string; suffix?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-2">{label}</label>
      <div className="flex items-center rounded-md border border-border bg-white px-2">
        {prefix && <span className="text-sm text-text-3">{prefix}</span>}
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent px-1 py-2 text-sm outline-none" />
        {suffix && <span className="text-sm text-text-3">{suffix}</span>}
      </div>
    </div>
  )
}
