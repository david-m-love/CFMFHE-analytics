import { PageHeader } from '@/components/page-header'
import { ComingSoon } from '@/components/coming-soon'

export default function ProductsPage() {
  return (
    <>
      <PageHeader
        title="Products"
        description="Non-membership product performance."
      />
      <ComingSoon
        phase="Phase 6"
        items={[
          'Total product revenue, top product by revenue & units, AOV',
          'Revenue by product category over time',
          'Best sellers table and seasonal product calendar',
          'EC Flipbook revenue trend',
        ]}
      />
    </>
  )
}
