import { PageHeader } from '@/components/page-header'
import { MembershipFunnel } from '@/components/membership/MembershipFunnel'

const TABS = [
  { label: 'Funnel', active: true },
  { label: 'Overview', active: false },
  { label: 'Cohorts', active: false },
  { label: 'LTV', active: false },
]

export default function MembershipPage() {
  return (
    <>
      <PageHeader
        title="Membership"
        description="The acquisition & retention funnel — from reach to long-term members."
      />

      <div className="mb-5 flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <span
            key={t.label}
            className={
              t.active
                ? 'relative -mb-px border-b-2 border-accent-blue px-3 py-2 text-sm font-medium text-ink'
                : 'px-3 py-2 text-sm text-text-3'
            }
          >
            {t.label}
            {!t.active && (
              <span className="ml-1 font-mono text-[9px] uppercase text-text-3">soon</span>
            )}
          </span>
        ))}
      </div>

      <MembershipFunnel />
    </>
  )
}
