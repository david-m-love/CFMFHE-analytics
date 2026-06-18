import { PageHeader } from '@/components/page-header'
import { ComingSoon } from '@/components/coming-soon'

export default function MembershipPage() {
  return (
    <>
      <PageHeader
        title="Membership"
        description="Deep dive on membership health — the most important view."
      />
      <ComingSoon
        phase="Phase 2–3"
        items={[
          'Active members & MRR by plan type ($10 vs $12 monthly, yearly, semiannual, quarterly, workbook)',
          '8-stage acquisition funnel (volume / revenue toggle, drop-off %)',
          'Quarterly cohort retention heat map + January YoY comparison',
          'LTV by plan type, distribution buckets, and monthly→annual upgrade analysis',
        ]}
      />
    </>
  )
}
