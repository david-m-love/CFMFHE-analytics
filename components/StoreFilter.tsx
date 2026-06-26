'use client'

import { useDashboard, type StoreFilter as Filter } from '@/store/dashboard'
import { cn } from '@/lib/utils'

const OPTIONS: { value: Filter; short: string; long: string }[] = [
  { value: 'all', short: 'All', long: 'All Stores' },
  { value: 'cfmfhe', short: 'CFMFHE', long: 'comefollowmefhe.com' },
  { value: 'ec', short: 'EC', long: 'essentialconversationsforfamilies.com' },
]

export function StoreFilter() {
  const { storeFilter, setStoreFilter } = useDashboard()
  return (
    <div className="inline-flex shrink-0 rounded-md border border-border bg-card p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => setStoreFilter(o.value)}
          title={o.long}
          className={cn(
            'whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-medium transition-colors md:px-3',
            storeFilter === o.value
              ? 'bg-ink text-white'
              : 'text-text-2 hover:bg-paper',
          )}
        >
          <span className="lg:hidden">{o.short}</span>
          <span className="hidden lg:inline">{o.long}</span>
        </button>
      ))}
    </div>
  )
}
