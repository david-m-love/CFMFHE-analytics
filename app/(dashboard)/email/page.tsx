import { PageHeader } from '@/components/page-header'
import { EmailDashboard } from '@/components/email/EmailDashboard'

export default function EmailPage() {
  return (
    <>
      <PageHeader
        title="Email & SMS"
        description="Klaviyo subscriber growth — how many contacts you're adding over time."
        showSource={false}
      />
      <EmailDashboard />
    </>
  )
}
