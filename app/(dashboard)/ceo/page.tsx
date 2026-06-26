'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { KpiCard } from '@/components/kpi-card'
import { useDefaultRange } from '@/components/use-default-range'
import {
  useCompareOrders,
  useFilteredOrders,
  useOrdersMeta,
  useStoreOrders,
} from '@/lib/use-orders'
import { useDashboard } from '@/store/dashboard'
import { estimatedMrr, totalRevenue } from '@/lib/metrics'
import { businessNewVsReturning } from '@/lib/identity'
import type { DataEnvelope } from '@/types'
import type { Financials } from '@/lib/quickbooks'

export default function CeoPage() {
  // CEO view opens on the last 7 days by default (once per session).
  useDefaultRange('ceo', 'last_7')

  const { loading } = useOrdersMeta()
  const filtered = useFilteredOrders()
  const compare = useCompareOrders()
  const allOrders = useStoreOrders()
  const { range, compareEnabled } = useDashboard()
  const cmp = compareEnabled ? compare : null

  const [fin, setFin] = useState<Financials | null>(null)
  const [finStatus, setFinStatus] = useState<'connected' | 'mock' | 'disconnected'>('mock')
  const [finNote, setFinNote] = useState<string>()

  useEffect(() => {
    let active = true
    fetch(`/api/data/quickbooks?from=${range.from}&to=${range.to}`, { cache: 'no-store' })
      .then((r) => r.json() as Promise<DataEnvelope<Financials>>)
      .then((env) => {
        if (!active) return
        setFin(env.data)
        setFinStatus(env.status as 'connected' | 'mock' | 'disconnected')
        setFinNote(env.note)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [range.from, range.to])

  const sales = totalRevenue(filtered)
  const mrr = estimatedMrr(filtered)
  const nvr = useMemo(
    () => businessNewVsReturning(allOrders, range.from, range.to),
    [allOrders, range.from, range.to],
  )
  const netCash = fin ? fin.moneyIn - fin.moneyOut : 0

  return (
    <>
      <PageHeader
        title="CEO"
        description="The whole business at a glance for the selected period."
        showSource={false}
      />

      {finStatus !== 'connected' && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-[#ecdcc2] bg-[#f6eddf] px-3 py-2 text-xs text-accent-amber">
          <Info size={14} className="shrink-0" />
          {finNote ?? 'Showing sample finances.'}{' '}
          <Link href="/connections" className="font-medium underline">
            Connect QuickBooks
          </Link>
        </div>
      )}

      {loading || !fin ? (
        <div className="h-40 animate-pulse rounded-lg border border-border bg-card" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <KpiCard label="Cash Balance" value={fin.cashBalance} format="currency" hint="from QuickBooks" />
          <KpiCard label="Money In" value={fin.moneyIn} format="currency" hint="this period" />
          <KpiCard label="Money Out" value={fin.moneyOut} format="currency" goodWhen="down" hint="this period" />
          <KpiCard label="Net Cash Flow" value={netCash} format="currency" hint="in − out" />
          <KpiCard label="Total Sales" value={sales} previous={cmp ? totalRevenue(cmp) : undefined} format="currency" />
          <KpiCard label="MRR" value={mrr} previous={cmp ? estimatedMrr(cmp) : undefined} format="currency" info="mrr" />
          <KpiCard
            label="New Customers"
            value={nvr.newCustomers}
            format="number"
            info="newVsReturning"
            secondaryValue={nvr.newRevenue}
            secondaryFormat="currency"
          />
          <KpiCard label="Returning Customers" value={nvr.returningCustomers} format="number" secondaryValue={nvr.returningRevenue} secondaryFormat="currency" />
        </div>
      )}

      <p className="mt-4 text-xs text-text-3">
        Cash balance and money in/out come from QuickBooks; sales &amp; members come from your
        order data. Use the date range up top to change the window (defaults to the last 7 days).
      </p>
    </>
  )
}
