'use client'

import type { TooltipProps } from 'recharts'

interface Props extends TooltipProps<number, string> {
  formatter?: (value: number | string) => string
}

/** Dark tooltip showing all series values (per the brief's chart style). */
export function ChartTooltip({ active, payload, label, formatter }: Props) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-md border border-ink/20 bg-ink px-3 py-2 text-xs text-white shadow-lg">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-white/60">
        {label}
      </div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ background: p.color ?? '#fff' }}
            />
            {p.name}
          </span>
          <span className="font-mono tabular-nums">
            {formatter ? formatter(p.value as number) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}
