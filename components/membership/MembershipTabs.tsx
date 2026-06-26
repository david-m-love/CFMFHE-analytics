'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Overview', href: '/membership' },
  { label: 'Funnel', href: '/membership/funnel' },
  { label: 'Cohorts', href: '/membership/cohorts' },
  { label: 'LTV', href: '/membership/ltv' },
] as const

export function MembershipTabs() {
  const pathname = usePathname()
  return (
    <div className="mb-5 flex items-center gap-1 border-b border-border">
      {TABS.map((t) => {
        const active = t.href === pathname
        return (
          <Link
            key={t.label}
            href={t.href}
            className={
              active
                ? 'relative -mb-px border-b-2 border-accent-blue px-3 py-2 text-sm font-medium text-ink'
                : 'px-3 py-2 text-sm text-text-2 hover:text-ink'
            }
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
