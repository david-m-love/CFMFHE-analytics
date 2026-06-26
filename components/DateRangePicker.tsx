'use client'

import { useEffect, useState } from 'react'
import { DayPicker, type DateRange as RDPRange } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { ArrowLeft, ArrowLeftRight, CalendarDays, Check, ChevronDown, X } from 'lucide-react'
import { useDashboard, type CompareSelect } from '@/store/dashboard'
import {
  QUICK_SELECT_LABELS,
  type QuickSelect,
  formatRangeLabel,
} from '@/lib/date-ranges'
import { useMediaQuery } from '@/lib/use-mobile'
import { cn } from '@/lib/utils'

const QUICK_ORDER: QuickSelect[] = [
  'last_7',
  'last_14',
  'last_30',
  'last_60',
  'last_90',
  'this_month',
  'last_month',
  'this_quarter',
  'last_quarter',
  'ytd',
  'custom',
]

const COMPARE_OPTIONS: { value: 'none' | CompareSelect; label: string }[] = [
  { value: 'none', label: 'No comparison' },
  { value: 'previous_period', label: 'Previous period' },
  { value: 'previous_year', label: 'Previous year' },
  { value: 'custom', label: 'Custom…' },
]

const toISO = (d: Date) => d.toISOString().slice(0, 10)

type Panel = 'date' | 'compare' | null

function Sheet({
  title,
  onClose,
  onBack,
  children,
}: {
  title: string
  onClose: () => void
  onBack?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[60]">
      <button aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-card p-4 shadow-xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[560px] sm:max-w-[92vw] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
        <div className="mb-3 flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="rounded-md p-1 text-text-3 hover:bg-paper">
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 className="font-serif text-lg text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-text-3 hover:bg-paper"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ListRow({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
        active ? 'bg-[#eaf0f6] text-accent-blue' : 'text-text-2 hover:bg-paper',
      )}
    >
      {label}
      {active && <Check size={15} />}
    </button>
  )
}

export function DateRangePicker() {
  const {
    quickSelect,
    range,
    compareEnabled,
    compareSelect,
    compareRange,
    setQuickSelect,
    setCustomRange,
    toggleCompare,
    setCompareSelect,
    setCustomCompareRange,
  } = useDashboard()

  const [panel, setPanel] = useState<Panel>(null)
  const [calMode, setCalMode] = useState(false)
  const [draft, setDraft] = useState<RDPRange | undefined>()
  const [compareDraft, setCompareDraft] = useState<RDPRange | undefined>()
  const isMobile = useMediaQuery()
  const calMonths = isMobile ? 1 : 2

  useEffect(() => {
    document.body.style.overflow = panel ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [panel])

  function close() {
    setPanel(null)
    setCalMode(false)
  }

  function chooseQuick(q: QuickSelect) {
    if (q === 'custom') {
      setDraft({ from: new Date(range.from), to: new Date(range.to) })
      setCalMode(true)
      return
    }
    setQuickSelect(q)
    close()
  }

  function applyCustom() {
    if (draft?.from && draft.to) {
      setCustomRange({ from: toISO(draft.from), to: toISO(draft.to) })
      close()
    }
  }

  function chooseCompare(value: 'none' | CompareSelect) {
    if (value === 'none') {
      toggleCompare(false)
      close()
      return
    }
    if (value === 'custom') {
      toggleCompare(true)
      setCompareSelect('custom')
      setCompareDraft(
        compareRange
          ? { from: new Date(compareRange.from), to: new Date(compareRange.to) }
          : undefined,
      )
      setCalMode(true)
      return
    }
    toggleCompare(true)
    setCompareSelect(value)
    close()
  }

  function applyCustomCompare() {
    if (compareDraft?.from && compareDraft.to) {
      setCustomCompareRange({ from: toISO(compareDraft.from), to: toISO(compareDraft.to) })
      close()
    }
  }

  const compareLabel =
    compareEnabled && compareRange ? formatRangeLabel(compareRange) : 'No comparison'

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <Pill icon={<CalendarDays size={15} />} onClick={() => { setPanel('date'); setCalMode(false) }}>
          {formatRangeLabel(range)}
        </Pill>
        <Pill icon={<ArrowLeftRight size={15} />} onClick={() => { setPanel('compare'); setCalMode(false) }} muted={!compareEnabled}>
          {compareLabel}
        </Pill>
      </div>

      {panel === 'date' && !calMode && (
        <Sheet title="Date range" onClose={close}>
          <div className="space-y-0.5">
            {QUICK_ORDER.map((q) => (
              <ListRow
                key={q}
                label={QUICK_SELECT_LABELS[q]}
                active={quickSelect === q}
                onClick={() => chooseQuick(q)}
              />
            ))}
          </div>
        </Sheet>
      )}

      {panel === 'date' && calMode && (
        <Sheet title="Custom range" onClose={close} onBack={() => setCalMode(false)}>
          <div className="flex justify-center">
            <DayPicker
              mode="range"
              numberOfMonths={calMonths}
              selected={draft}
              onSelect={setDraft}
              defaultMonth={new Date(range.from)}
            />
          </div>
          <SheetFooter
            summary={draft?.from && draft.to ? `${toISO(draft.from)} → ${toISO(draft.to)}` : 'Pick start & end'}
            disabled={!draft?.from || !draft?.to}
            onApply={applyCustom}
            onCancel={() => setCalMode(false)}
          />
        </Sheet>
      )}

      {panel === 'compare' && !calMode && (
        <Sheet title="Compare to" onClose={close}>
          <div className="space-y-0.5">
            {COMPARE_OPTIONS.map((o) => {
              const active =
                o.value === 'none' ? !compareEnabled : compareEnabled && compareSelect === o.value
              return (
                <ListRow key={o.value} label={o.label} active={active} onClick={() => chooseCompare(o.value)} />
              )
            })}
          </div>
          {compareEnabled && compareRange && (
            <p className="mt-3 px-1 font-mono text-xs text-text-3">
              {formatRangeLabel(range)} vs {formatRangeLabel(compareRange)}
            </p>
          )}
        </Sheet>
      )}

      {panel === 'compare' && calMode && (
        <Sheet title="Custom comparison" onClose={close} onBack={() => setCalMode(false)}>
          <div className="flex justify-center">
            <DayPicker
              mode="range"
              numberOfMonths={calMonths}
              selected={compareDraft}
              onSelect={setCompareDraft}
            />
          </div>
          <SheetFooter
            summary={
              compareDraft?.from && compareDraft.to
                ? `${toISO(compareDraft.from)} → ${toISO(compareDraft.to)}`
                : 'Pick start & end'
            }
            disabled={!compareDraft?.from || !compareDraft?.to}
            onApply={applyCustomCompare}
            onCancel={() => setCalMode(false)}
          />
        </Sheet>
      )}
    </>
  )
}

function Pill({
  icon,
  children,
  onClick,
  muted,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  onClick: () => void
  muted?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-card px-3 py-2 text-sm text-ink hover:bg-paper"
    >
      <span className="text-text-3">{icon}</span>
      <span className={cn('font-medium', muted && 'text-text-3')}>{children}</span>
      <ChevronDown size={15} className="text-text-3" />
    </button>
  )
}

function SheetFooter({
  summary,
  disabled,
  onApply,
  onCancel,
}: {
  summary: string
  disabled: boolean
  onApply: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
      <span className="font-mono text-xs text-text-3">{summary}</span>
      <div className="flex gap-2">
        <button onClick={onCancel} className="rounded-md px-3 py-2 text-sm text-text-2 hover:bg-paper">
          Cancel
        </button>
        <button
          onClick={onApply}
          disabled={disabled}
          className="rounded-md bg-accent-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Apply
        </button>
      </div>
    </div>
  )
}
