'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Funnel', href: '/membership' },
  { label: 'Cohorts', href: '/membership/cohorts' },
  { label: 'Overview', href: null },
  { label: 'LTV', href: null },
] as const

export function MembershipTabs() {
  const pathname = usePathname()
  return (
    <div className="mb-5 flex items-center gap-1 border-b border-border">
      {TABS.map((t) => {
        const active = t.href === pathname
        if (!t.href) {
          return (
            <span key={t.label} className="px-3 py-2 text-sm text-text-3">
              {t.label}
              <span className="ml-1 font-mono text-[9px] uppercase text-text-3">soon</span>
            </span>
          )
        }
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
