import { PageHeader } from '@/components/page-header'
import { ComingSoon } from '@/components/coming-soon'

export default function TrafficPage() {
  return (
    <>
      <PageHeader
        title="Traffic"
        description="GA4 sessions, sources, and the /join-us funnel."
      />
      <ComingSoon
        phase="Phase 4"
        items={[
          'Total sessions, new vs returning, /join-us sessions, avg duration, bounce rate',
          'Sessions over time and traffic source breakdown',
          'Top landing pages by sessions',
          '/join-us funnel: sessions → CTA click → trial start',
        ]}
      />
    </>
  )
}
