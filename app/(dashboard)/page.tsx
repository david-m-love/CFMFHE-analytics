'use client'

import { PageHeader } from '@/components/page-header'
import { KpiCard } from '@/components/kpi-card'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { NetMembersChart } from '@/components/charts/NetMembersChart'
import { PlanMixDonut } from '@/components/charts/PlanMixDonut'
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
  freeTrialStarts,
  monthlyNetMembers,
  monthlyRevenue,
  newMembers,
  planMix,
  totalRevenue,
  trialConversionRate,
} from '@/lib/metrics'
import { BENCHMARKS, JANUARY_ANOMALY_NOTE } from '@/lib/config'

export default function OverviewPage() {
  const { loading } = useOrdersMeta()
  const filtered = useFilteredOrders()
  const compare = useCompareOrders()
  const storeOrders = useStoreOrders()
  const { compareEnabled } = useDashboard()

  const churn = BENCHMARKS.monthlyChurn.current
  const revData = monthlyRevenue(storeOrders, 12)
  const memberData = monthlyNetMembers(storeOrders, churn, 12)
  const mix = planMix(filtered)
  const cmp = compareEnabled ? compare : null

  return (
    <>
      <PageHeader
        title="Overview"
        description="At-a-glance membership & revenue health."
      />

      {loading ? (
        <LoadingGrid />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <KpiCard
              label="Active Members"
              value={estimatedActiveMembers(filtered)}
              previous={cmp ? estimatedActiveMembers(cmp) : undefined}
              format="number"
            />
            <KpiCard
              label="MRR"
              value={estimatedMrr(filtered)}
              previous={cmp ? estimatedMrr(cmp) : undefined}
              format="currency"
            />
            <KpiCard
              label="New Members"
              value={newMembers(filtered)}
              previous={cmp ? newMembers(cmp) : undefined}
              format="number"
            />
            <KpiCard
              label="Free Trial Starts"
              value={freeTrialStarts(filtered)}
              previous={cmp ? freeTrialStarts(cmp) : undefined}
              format="number"
            />
            <KpiCard
              label="Trial → Paid"
              value={trialConversionRate(filtered)}
              previous={cmp ? trialConversionRate(cmp) : undefined}
              format="percent"
            />
            <KpiCard
              label="Monthly Churn (est.)"
              value={churn}
              format="percent"
              goodWhen="down"
              hint="estimate"
            />
            <KpiCard
              label="Revenue"
              value={totalRevenue(filtered)}
              previous={cmp ? totalRevenue(cmp) : undefined}
              format="currency"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Monthly Revenue</CardTitle>
                <Badge tone="neutral">12 months · new vs returning</Badge>
              </CardHeader>
              <CardBody>
                <RevenueChart data={revData} />
                <JanuaryFootnote />
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>New vs Churned Members</CardTitle>
                <Badge tone="neutral">net line · churn estimated</Badge>
              </CardHeader>
              <CardBody>
                <NetMembersChart data={memberData} />
                <JanuaryFootnote />
              </CardBody>
            </Card>
          </div>

          <div className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Plan Mix</CardTitle>
              </CardHeader>
              <CardBody>
                {mix.length ? (
                  <PlanMixDonut data={mix} />
                ) : (
                  <p className="text-sm text-text-3">
                    No membership orders in the selected range.
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </>
  )
}

function JanuaryFootnote() {
  return (
    <p className="mt-2 font-mono text-[10px] leading-snug text-text-3">
      <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-accent-blue/55 align-middle" />
      {JANUARY_ANOMALY_NOTE}
    </p>
  )
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-lg border border-border bg-card"
        />
      ))}
    </div>
  )
}
