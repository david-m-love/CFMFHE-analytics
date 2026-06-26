import { PageHeader } from '@/components/page-header'
import { MembershipTabs } from '@/components/membership/MembershipTabs'
import { MembershipOverview } from '@/components/membership/MembershipOverview'

export default function MembershipPage() {
  return (
    <>
      <PageHeader
        title="Membership"
        description="Membership health at a glance — members, MRR, and plan mix."
      />
      <MembershipTabs />
      <MembershipOverview />
    </>
  )
}
