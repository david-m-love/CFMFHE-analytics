'use client'

import { useEffect, useRef, useState } from 'react'
import { DayPicker, type DateRange as RDPRange } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { CalendarDays, Check, ChevronDown } from 'lucide-react'
import { useDashboard, type CompareSelect } from '@/store/dashboard'
import {
  QUICK_SELECT_LABELS,
  type QuickSelect,
  formatRangeLabel,
} from '@/lib/date-ranges'
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

const COMPARE_LABELS: Record<CompareSelect, string> = {
  previous_period: 'Previous period',
  previous_year: 'Previous year',
  custom: 'Custom…',
}

const toISO = (d: Date) => d.toISOString().slice(0, 10)

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

  const [open, setOpen] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [draft, setDraft] = useState<RDPRange | undefined>()
  const [compareDraft, setCompareDraft] = useState<RDPRange | undefined>()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function chooseQuick(q: QuickSelect) {
    if (q === 'custom') {
      setShowCalendar(true)
      setDraft({ from: new Date(range.from), to: new Date(range.to) })
      return
    }
    setQuickSelect(q)
    setShowCalendar(false)
  }

  function applyCustom() {
    if (draft?.from && draft.to) {
      setCustomRange({ from: toISO(draft.from), to: toISO(draft.to) })
      setShowCalendar(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-ink hover:bg-paper"
      >
        <CalendarDays size={15} className="text-text-3" />
        <span className="font-medium">{formatRangeLabel(range)}</span>
        {compareEnabled && compareRange && (
          <span className="font-mono text-xs text-text-3">
            vs {formatRangeLabel(compareRange)}
          </span>
        )}
        <ChevronDown size={15} className="text-text-3" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[640px] max-w-[92vw] rounded-lg border border-border bg-card p-3 shadow-lg">
          <div className="flex gap-3">
            <ul className="w-44 shrink-0 space-y-0.5">
              {QUICK_ORDER.map((q) => (
                <li key={q}>
                  <button
                    onClick={() => chooseQuick(q)}
                    className={cn(
                      'flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-sm transition-colors',
                      (quickSelect === q && !showCalendar) ||
                        (q === 'custom' && showCalendar)
                        ? 'bg-[#eaf0f6] text-accent-blue'
                        : 'text-text-2 hover:bg-paper',
                    )}
                  >
                    {QUICK_SELECT_LABELS[q]}
                    {quickSelect === q && !showCalendar && <Check size={14} />}
                  </button>
                </li>
              ))}
            </ul>

            <div className="min-w-0 flex-1 border-l border-border pl-3">
              {showCalendar ? (
                <div>
                  <DayPicker
                    mode="range"
                    numberOfMonths={2}
                    selected={draft}
                    onSelect={setDraft}
                    defaultMonth={new Date(range.from)}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      onClick={() => setShowCalendar(false)}
                      className="rounded-md px-3 py-1.5 text-sm text-text-2 hover:bg-paper"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={applyCustom}
                      disabled={!draft?.from || !draft?.to}
                      className="rounded-md bg-accent-blue px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-1 py-2 text-sm text-text-2">
                  <p className="font-medium text-ink">{formatRangeLabel(range)}</p>
                  <p className="mt-1 text-xs text-text-3">
                    Pick a quick range, or choose “Custom range…” for a calendar.
                  </p>
                </div>
              )}

              {/* Compare controls */}
              <div className="mt-3 border-t border-border pt-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={compareEnabled}
                    onChange={(e) => toggleCompare(e.target.checked)}
                    className="accent-[#3B6FA0]"
                  />
                  Compare to another period
                </label>

                {compareEnabled && (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(COMPARE_LABELS) as CompareSelect[]).map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            setCompareSelect(c)
                            if (c === 'custom') {
                              setCompareDraft(
                                compareRange
                                  ? {
                                      from: new Date(compareRange.from),
                                      to: new Date(compareRange.to),
                                    }
                                  : undefined,
                              )
                            }
                          }}
                          className={cn(
                            'rounded-md border px-2.5 py-1 text-xs',
                            compareSelect === c
                              ? 'border-accent-blue bg-[#eaf0f6] text-accent-blue'
                              : 'border-border text-text-2 hover:bg-paper',
                          )}
                        >
                          {COMPARE_LABELS[c]}
                        </button>
                      ))}
                    </div>

                    {compareSelect === 'custom' && (
                      <div>
                        <DayPicker
                          mode="range"
                          numberOfMonths={2}
                          selected={compareDraft}
                          onSelect={setCompareDraft}
                        />
                        <div className="mt-1 flex justify-end">
                          <button
                            onClick={() => {
                              if (compareDraft?.from && compareDraft.to) {
                                setCustomCompareRange({
                                  from: toISO(compareDraft.from),
                                  to: toISO(compareDraft.to),
                                })
                              }
                            }}
                            disabled={!compareDraft?.from || !compareDraft?.to}
                            className="rounded-md bg-accent-blue px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                          >
                            Apply comparison
                          </button>
                        </div>
                      </div>
                    )}

                    {compareRange && (
                      <p className="font-mono text-xs text-text-3">
                        {formatRangeLabel(range)} vs {formatRangeLabel(compareRange)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
