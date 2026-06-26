import { PageHeader } from '@/components/page-header'
import { MembershipTabs } from '@/components/membership/MembershipTabs'
import { MembershipFunnel } from '@/components/membership/MembershipFunnel'

export default function MembershipPage() {
  return (
    <>
      <PageHeader
        title="Membership"
        description="The acquisition & retention funnel — from reach to long-term members."
      />
      <MembershipTabs />
      <MembershipFunnel />
    </>
  )
}
