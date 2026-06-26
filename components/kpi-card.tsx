'use client'

import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { InfoTip } from '@/components/info-tip'
import { cn, formatCurrency, formatNumber, formatPercent, pctDelta } from '@/lib/utils'

type Format = 'currency' | 'number' | 'percent'

interface Props {
  label: string
  value: number
  previous?: number | null
  format: Format
  goodWhen?: 'up' | 'down'
  hint?: string
  /** glossary key for an ⓘ definition next to the label */
  info?: string
  /** optional secondary metric shown in the same card (e.g. a count next to revenue) */
  secondaryValue?: number
  secondaryFormat?: Format
  secondaryLabel?: string
}

function fmt(v: number, format: Format) {
  if (format === 'currency') return formatCurrency(v)
  if (format === 'percent') return formatPercent(v)
  return formatNumber(v)
}

export function KpiCard({
  label,
  value,
  previous,
  format,
  goodWhen = 'up',
  hint,
  info,
  secondaryValue,
  secondaryFormat = 'number',
  secondaryLabel,
}: Props) {
  const delta =
    previous != null && previous !== undefined ? pctDelta(value, previous) : undefined
  const up = delta != null && delta >= 0
  const good = delta == null ? null : goodWhen === 'up' ? up : !up

  return (
    <Card className="p-4">
      <div className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-text-3">
        {label}
        {info && <InfoTip term={info} />}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-medium text-ink tabular-nums">
          {fmt(value, format)}
        </span>
        {secondaryValue != null && (
          <span className="font-mono text-sm text-text-2 tabular-nums">
            {fmt(secondaryValue, secondaryFormat)}
            {secondaryLabel ? ` ${secondaryLabel}` : ''}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xs">
        {delta != null ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-mono font-medium',
              good ? 'text-accent-green' : 'text-accent-red',
            )}
          >
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {formatPercent(Math.abs(delta))}
          </span>
        ) : (
          <span className="text-text-3">{hint ?? '—'}</span>
        )}
        {delta != null && <span className="text-text-3">vs prior</span>}
      </div>
    </Card>
  )
}
