'use client'

import { useEffect, useState } from 'react'
import { KpiCard } from '@/components/kpi-card'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SubscribersChart } from '@/components/charts/SubscribersChart'
import { useDashboard } from '@/store/dashboard'
import type { KlaviyoOverview } from '@/lib/klaviyo'
import { formatNumber } from '@/lib/utils'

const EMPTY: KlaviyoOverview = {
  totalContacts: 0,
  newContacts: 0,
  newPerMonthAvg: 0,
  growthRatePct: 0,
  monthly: [],
  lists: [],
  capped: false,
}

export function EmailDashboard() {
  const { range } = useDashboard()
  const [data, setData] = useState<KlaviyoOverview>(EMPTY)
  const [note, setNote] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/data/klaviyo?from=${range.from}&to=${range.to}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.data) setData(d.data)
        setNote(d?.note)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [range.from, range.to])

  if (loading) {
    return <div className="h-40 animate-pulse rounded-lg border border-border bg-card" />
  }

  return (
    <>
      {note && <p className="mb-3 text-xs text-text-2">{note}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Contacts" value={data.totalContacts} format="number" hint="largest list" />
        <KpiCard
          label="New Contacts"
          value={data.newContacts}
          format="number"
          hint="selected period"
          secondaryValue={data.totalContacts > 0 ? data.growthRatePct : undefined}
          secondaryFormat="percent"
          secondaryLabel="list growth"
        />
        <KpiCard label="Avg New / Month" value={data.newPerMonthAvg} format="number" hint="last 12 mo" />
        <KpiCard label="Tracked Lists" value={data.lists.length} format="number" />
      </div>

      {data.capped && (
        <p className="mt-2 font-mono text-[10px] text-accent-amber">
          New-contact counts are based on the most recent profiles; very old months may undercount.
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>New Contacts Over Time</CardTitle>
            <Badge tone="neutral">last 12 months</Badge>
          </CardHeader>
          <CardBody>
            <SubscribersChart data={data.monthly} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Subscribers by List</CardTitle></CardHeader>
          <CardBody className="space-y-2 pt-2">
            {data.lists.length === 0 && <p className="text-sm text-text-2">No lists found.</p>}
            {data.lists.map((l) => {
              const max = data.lists[0]?.count || 1
              return (
                <div key={l.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate text-text-2">{l.name}</span>
                    <span className="ml-2 font-mono tabular-nums text-ink">{formatNumber(l.count)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper">
                    <div className="h-full rounded-full bg-accent-green" style={{ width: `${(l.count / max) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </CardBody>
        </Card>
      </div>
    </>
  )
}
