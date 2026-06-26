'use client'

import { useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import {
  useCompareOrders,
  useFilteredOrders,
  useOrdersMeta,
} from '@/lib/use-orders'
import { useDashboard } from '@/store/dashboard'
import { STAGE_DEFS, stageValue, type StageKpi } from '@/lib/funnel'
import { useMediaQuery } from '@/lib/use-mobile'
import { cn, formatNumber, pctDelta } from '@/lib/utils'

function daysBetween(from: string, to: string) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1
}

function deltaInfo(cur: number, cmp: number | null | undefined) {
  if (cmp == null) return null
  const p = pctDelta(cur, cmp)
  if (p == null) return null
  const up = p >= 0
  return { up, label: `${up ? '+' : ''}${Math.round(p * 100)}%` }
}

function DeltaChip({
  cur,
  cmp,
  suffix,
  className,
}: {
  cur: number
  cmp: number | null | undefined
  suffix?: string
  className?: string
}) {
  const d = deltaInfo(cur, cmp)
  if (!d) return null
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
        d.up ? 'bg-[#d3ede3] text-[#1f6b47]' : 'bg-[#f5ddd9] text-[#8b2e24]',
        className,
      )}
    >
      {d.label}
      {suffix ? ` ${suffix}` : ''}
    </span>
  )
}

export function MembershipFunnel() {
  const { loading } = useOrdersMeta()
  const orders = useFilteredOrders()
  const compare = useCompareOrders()
  const { range, compareSelect, compareEnabled } = useDashboard()
  const [activeIdx, setActiveIdx] = useState<number | null>(4) // default: Convert
  const isMobile = useMediaQuery()

  const days = daysBetween(range.from, range.to)
  const cmpSuffix = compareSelect === 'previous_year' ? 'vs LY' : 'vs prev'

  const stages = useMemo(
    () =>
      STAGE_DEFS.map((def) => ({
        def,
        current: stageValue(def.key, orders),
        compare: compare ? stageValue(def.key, compare) : null,
      })),
    [orders, compare],
  )

  const maxV = Math.max(1, ...stages.map((s) => s.current))
  const active = activeIdx != null ? stages[activeIdx] : null

  if (loading) {
    return <div className="h-96 animate-pulse rounded-lg border border-border bg-card" />
  }

  return (
    <div>
      {/* Placeholder note (revenue KPIs now live on the Overview tab) */}
      <div className="flex items-center gap-2 rounded-md border border-[#e8c84a] bg-[#fff8e6] px-3 py-2 text-xs text-[#7a6010]">
        <TriangleAlert size={14} className="shrink-0" />
        <span>
          <strong>Stages 1–3 are illustrative placeholders</strong> (GA4 + Klaviyo
          not yet connected). Stages 4–8 use real order data.
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Funnel bars */}
        <div>
          <div className="flex flex-col gap-1">
            {stages.map((s, i) => {
              const bw = Math.max(5, (s.current / maxV) * 100)
              const cbw = s.compare != null ? Math.max(2, (s.compare / maxV) * 100) : 0
              const pctOfReach = ((s.current / maxV) * 100).toFixed(0)

              // connector between stages
              let connector = null
              if (i > 0) {
                const prev = stages[i - 1].current
                const conv = prev > 0 ? Math.round((s.current / prev) * 100) : 0
                const exit = Math.max(0, 100 - conv)
                let bg = '#EDE9E0'
                let fg = '#9C9890'
                if (i >= 4) {
                  if (conv >= 70) {
                    bg = '#D3EDE3'
                    fg = '#1F6B47'
                  } else if (conv >= 40) {
                    bg = '#FFF8E6'
                    fg = '#7A6010'
                  } else {
                    bg = '#F5DDD9'
                    fg = '#8B2E24'
                  }
                }
                connector = (
                  <div className="flex h-4 items-center pl-[108px] sm:pl-[134px]">
                    <span className="text-[11px] text-text-3">↓</span>
                    <span
                      className="ml-1 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[9px] font-medium"
                      style={{ background: bg, color: fg }}
                    >
                      {conv}% continue · {exit}% exit
                    </span>
                    <span className="ml-2 h-px flex-1 bg-border" />
                  </div>
                )
              }

              return (
                <div key={s.def.key}>
                  {connector}
                  <button
                    onClick={() => setActiveIdx(activeIdx === i ? null : i)}
                    className={cn(
                      'flex w-full items-stretch overflow-hidden rounded-lg border-2 text-left transition-transform hover:translate-x-0.5',
                      activeIdx === i ? 'border-current' : 'border-transparent',
                    )}
                    style={{ color: activeIdx === i ? s.def.color : 'transparent' }}
                  >
                    <span className="flex w-[104px] shrink-0 flex-col justify-center gap-0.5 border-r border-border bg-card px-2.5 py-2 sm:w-[130px] sm:px-3">
                      <span className="font-mono text-[9px] tracking-wider text-text-3">
                        STAGE {s.def.num}
                      </span>
                      <span className="text-xs font-semibold text-ink">{s.def.name}</span>
                      <span className="text-[10px] text-text-3">{s.def.metric}</span>
                    </span>
                    <span className="relative flex min-h-[50px] flex-1 items-center overflow-hidden bg-[#EDE9E0]">
                      {s.compare != null && (
                        <span
                          className="absolute inset-y-0 left-0 z-0"
                          style={{
                            width: `${cbw}%`,
                            background: compareSelect === 'previous_year' ? '#4E86B8' : '#888780',
                            opacity: 0.25,
                          }}
                        />
                      )}
                      <span
                        className="relative z-10 flex h-full items-center px-2.5"
                        style={{ width: `${bw}%`, background: s.def.color, transition: 'width .6s cubic-bezier(.4,0,.2,1)' }}
                      >
                        <span
                          className="whitespace-nowrap font-serif text-[19px] leading-none text-white"
                          style={{ textShadow: '0 1px 2px rgba(0,0,0,.2)' }}
                        >
                          {formatNumber(s.current)}
                        </span>
                      </span>
                      <span className="absolute right-0 z-20 flex min-w-[58px] flex-col justify-center gap-0.5 bg-gradient-to-l from-[#EDE9E0] from-40% to-transparent px-2 py-1.5 sm:min-w-[108px] sm:px-2.5">
                        <span className="hidden font-mono text-[10px] font-medium text-text-2 sm:block">
                          {pctOfReach}% of reach
                        </span>
                        {s.compare != null && (
                          <DeltaChip cur={s.current} cmp={s.compare} suffix={cmpSuffix} />
                        )}
                      </span>
                    </span>
                  </button>

                  {/* Mobile: detail opens as an accordion right under the stage */}
                  {isMobile && activeIdx === i && (
                    <div
                      className="mt-1 rounded-lg border-l-2 bg-card p-4"
                      style={{ borderColor: s.def.color }}
                    >
                      <DetailPanel
                        stage={s}
                        days={days}
                        cmpSuffix={cmpSuffix}
                        compareEnabled={compareEnabled}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Key conversion rates */}
          <ConversionKey stages={stages} />
        </div>

        {/* Detail panel (desktop only; mobile shows it inline as an accordion) */}
        <div className="hidden rounded-lg border border-border bg-card p-4 lg:block lg:sticky lg:top-4 lg:self-start">
          {active ? (
            <DetailPanel
              stage={active}
              days={days}
              cmpSuffix={cmpSuffix}
              compareEnabled={compareEnabled}
            />
          ) : (
            <p className="py-12 text-center text-sm text-text-3">
              Click a stage to see its details.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ConversionKey({
  stages,
}: {
  stages: { def: { key: string }; current: number }[]
}) {
  const byKey = (k: string) => stages.find((s) => s.def.key === k)?.current ?? 0
  const trials = byKey('trials')
  const firstPaid = byKey('firstPaid')
  const trialToPaid = trials > 0 ? `${Math.round((firstPaid / trials) * 100)}%` : 'N/A'

  const cards = [
    { label: 'Visitor → Consider', value: '~10%', sub: 'Find the /join-us page · Est.' },
    { label: 'Consider → Try', value: '~2.1%', sub: 'Page view to trial start · Est.' },
    { label: 'Trial → Paid', value: trialToPaid, sub: 'This period · Real data' },
    { label: 'Month 1 → Month 12', value: '~27%', sub: 'Jan cohort avg · Real data' },
  ]
  return (
    <>
      <div className="my-4 flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-wider text-text-3">
        Key Conversion Rates
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="font-mono text-[9px] uppercase tracking-wider text-text-3">
              {c.label}
            </div>
            <div className="mt-1 font-serif text-2xl leading-none text-ink">{c.value}</div>
            <div className="mt-1 text-[11px] text-text-2">{c.sub}</div>
          </div>
        ))}
      </div>
    </>
  )
}

function DetailPanel({
  stage,
  days,
  cmpSuffix,
  compareEnabled,
}: {
  stage: { def: (typeof STAGE_DEFS)[number]; current: number; compare: number | null }
  days: number
  cmpSuffix: string
  compareEnabled: boolean
}) {
  const { def, current, compare } = stage
  const kpis: StageKpi[] = def.kpis(current, compare, days)
  const statusLabel =
    def.status === 'live' ? 'Real data available' : 'Placeholder — data needed'
  const statusColor = def.status === 'live' ? '#2A7A58' : '#C4A030'

  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-wider" style={{ color: def.color }}>
        Stage {def.num} · {def.metric}
      </div>
      <div className="font-serif text-xl text-ink">{def.name}</div>
      {compareEnabled && compare != null && (
        <DeltaChip cur={current} cmp={compare} suffix={cmpSuffix} className="mt-1.5" />
      )}
      <p className="mt-2 text-xs leading-relaxed text-text-2">{def.desc}</p>

      <hr className="my-3 border-border" />

      <div className="grid grid-cols-2 gap-2">
        {kpis.map((k) => {
          const cmpNum = typeof k.value === 'number' ? (k.compareValue ?? null) : null
          return (
            <div key={k.label} className="rounded-md bg-paper px-2.5 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-text-3">
                {k.label}
              </div>
              <div className="font-serif text-lg leading-none" style={{ color: def.color }}>
                {typeof k.value === 'number' ? formatNumber(k.value) : k.value}
              </div>
              <div className="mt-0.5 text-[10px] text-text-2">{k.sub}</div>
              {typeof k.value === 'number' && cmpNum != null && (
                <DeltaChip cur={k.value} cmp={cmpNum} className="mt-1" />
              )}
            </div>
          )
        })}
      </div>

      <hr className="my-3 border-border" />

      <div className="flex flex-col gap-1.5">
        {def.insights.map((html, i) => (
          <p
            key={i}
            className="rounded-md bg-paper px-2.5 py-2 text-[11px] leading-relaxed text-text-2 [&_strong]:text-ink"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-text-3">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} />
        {statusLabel}
      </div>
    </div>
  )
}
