'use client'

import { useDashboard, type StoreFilter as Filter } from '@/store/dashboard'
import { cn } from '@/lib/utils'

const OPTIONS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All Stores' },
  { value: 'cfmfhe', label: 'comefollowmefhe.com' },
  { value: 'ec', label: 'essentialconversationsforfamilies.com' },
]

export function StoreFilter() {
  const { storeFilter, setStoreFilter } = useDashboard()
  return (
    <div className="inline-flex rounded-md border border-border bg-card p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => setStoreFilter(o.value)}
          className={cn(
            'rounded px-3 py-1.5 text-xs font-medium transition-colors',
            storeFilter === o.value
              ? 'bg-ink text-white'
              : 'text-text-2 hover:bg-paper',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
