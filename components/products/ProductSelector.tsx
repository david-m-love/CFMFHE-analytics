'use client'

import { useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Type-ahead multi-select over product names. Pick specific products to pull
 * into the comparison analysis.
 */
export function ProductSelector({
  names,
  selected,
  onChange,
}: {
  names: string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return names.filter((n) => n.toLowerCase().includes(q) && !selected.includes(n)).slice(0, 8)
  }, [query, names, selected])

  function add(name: string) {
    onChange([...selected, name])
    setQuery('')
  }

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2">
        <Search size={15} className="shrink-0 text-text-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Type a product name to add it…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {focused && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg">
          {matches.map((n) => (
            <li key={n}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  add(n)
                }}
                className="block w-full truncate px-3 py-2 text-left text-sm text-text-2 hover:bg-paper"
              >
                {n}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((n, i) => (
            <span
              key={n}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs',
                'text-ink',
              )}
            >
              <span className="h-2 w-2 rounded-sm" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
              <span className="max-w-[160px] truncate">{n}</span>
              <button onClick={() => onChange(selected.filter((x) => x !== n))} aria-label="Remove">
                <X size={12} className="text-text-3 hover:text-accent-red" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export const SERIES_COLORS = ['#3B6FA0', '#2A7A58', '#6B5EA8', '#C4A030', '#D07830', '#A04878']
