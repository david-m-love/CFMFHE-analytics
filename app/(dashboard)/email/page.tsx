import { PageHeader } from '@/components/page-header'
import { ComingSoon } from '@/components/coming-soon'

export default function EmailPage() {
  return (
    <>
      <PageHeader
        title="Email & SMS"
        description="Klaviyo subscriber growth, flows, and campaigns."
        showSource={false}
      />
      <ComingSoon
        phase="Phase 4"
        items={[
          'Total / active email subscribers, SMS subscribers, 30-day list growth',
          'Subscriber growth over time and top flows by revenue',
          'Recent campaign performance table (open / click / revenue)',
          'Flow status overview — flag the unconfigured Post-Purchase Upsell flow',
        ]}
      />
    </>
  )
}
