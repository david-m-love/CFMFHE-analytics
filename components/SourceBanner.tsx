'use client'

import { Info, WifiOff } from 'lucide-react'
import { useOrdersMeta } from '@/lib/use-orders'
import { cn } from '@/lib/utils'

/** Shows mock/disconnected state + "data last updated" timestamp. */
export function SourceBanner() {
  const { status, note, updatedAt, loading } = useOrdersMeta()
  if (loading || status === 'connected') {
    return updatedAt ? (
      <p className="font-mono text-xs text-text-3">
        Data updated {new Date(updatedAt).toLocaleString('en-US')}
      </p>
    ) : null
  }

  const isDisconnected = status === 'disconnected'
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
        isDisconnected
          ? 'border-[#ecd0cc] bg-[#f6e6e4] text-accent-red'
          : 'border-[#ecdcc2] bg-[#f6eddf] text-accent-amber',
      )}
    >
      {isDisconnected ? <WifiOff size={14} /> : <Info size={14} />}
      <span>
        {note ??
          (isDisconnected
            ? 'A data source is currently unavailable.'
            : 'Showing sample data.')}
      </span>
    </div>
  )
}
