'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useOrdersMeta } from '@/lib/use-orders'
import { useDashboard } from '@/store/dashboard'
import { cn } from '@/lib/utils'

function ago(iso: string | null): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (!isFinite(ms) || ms < 0) return 'just now'
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/** Manual data refresh + live freshness indicator, shown in the header. */
export function DataRefresh() {
  const { refreshing, updatedAt } = useOrdersMeta()
  const refreshData = useDashboard((s) => s.refreshData)

  // Re-render every 30s so "Updated Xm ago" stays current.
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <button
      onClick={refreshData}
      disabled={refreshing}
      title="Refresh data"
      className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-2 text-xs text-text-2 transition-colors hover:text-ink disabled:opacity-70"
    >
      <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
      <span className="hidden whitespace-nowrap sm:inline">
        {refreshing ? 'Updating…' : updatedAt ? `Updated ${ago(updatedAt)}` : 'Refresh'}
      </span>
    </button>
  )
}
