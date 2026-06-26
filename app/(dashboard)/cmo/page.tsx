'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Settings2, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { KpiCard } from '@/components/kpi-card'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InfoTip } from '@/components/info-tip'
import { useFilteredOrders, useOrdersMeta, useStoreOrders } from '@/lib/use-orders'
import { useDashboard } from '@/store/dashboard'
import {
  computeCmo,
  DEFAULT_CMO_SETTINGS,
  type CmoSettings,
} from '@/lib/marketing'
import { cn, formatCurrency, formatPercent } from '@/lib/utils'

export default function CmoPage() {
  const { loading } = useOrdersMeta()
  const filtered = useFilteredOrders()
  const allOrders = useStoreOrders()
  const { range } = useDashboard()
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin' || !session

  const [settings, setSettings] = useState<CmoSettings>(DEFAULT_CMO_SETTINGS)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    fetch('/api/settings/cmo', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => d?.settings && setSettings(d.settings))
      .catch(() => {})
  }, [])

  const m = useMemo(
    () => computeCmo(filtered, allOrders, range.from, range.to, settings),
    [filtered, allOrders, range.from, range.to, settings],
  )

  return (
    <>
      <PageHeader
        title="CMO"
        description="Marketing efficiency: ad spend, ROAS, acquisition cost, and contribution margin."
        showSource={false}
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        {m.adSpend <= 0 && (
          <p className="text-xs text-text-2">
            Add ad spend to unlock ROAS &amp; CAC.{' '}
            {isAdmin && (
              <button onClick={() => setEditing(true)} className="font-medium text-accent-blue hover:underline">
                Enter assumptions
              </button>
            )}
          </p>
        )}
        <div className="ml-auto">
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

          <Card className="mt-4">
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
            <span className="text-xs font-medium text-text-2">Monthly ad spend</span>
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
          <p className="mt-1 text-[11px] text-text-3">Manual entry for now — Meta &amp; Google Ads connectors will fill this automatically next.</p>
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
