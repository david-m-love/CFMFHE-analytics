import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DateRange, StoreSource } from '@/types'
import {
  type QuickSelect,
  resolveCompare,
  resolveQuickSelect,
} from '@/lib/date-ranges'

export type StoreFilter = StoreSource | 'all'
export type CompareSelect = 'previous_period' | 'previous_year' | 'custom'

interface DashboardState {
  quickSelect: QuickSelect
  range: DateRange
  storeFilter: StoreFilter
  compareEnabled: boolean
  compareSelect: CompareSelect
  compareRange: DateRange | null

  setQuickSelect: (q: QuickSelect) => void
  setCustomRange: (range: DateRange) => void
  setStoreFilter: (s: StoreFilter) => void
  toggleCompare: (enabled: boolean) => void
  setCompareSelect: (c: CompareSelect) => void
  setCustomCompareRange: (range: DateRange) => void
}

const initialRange = resolveQuickSelect('last_30')

export const useDashboard = create<DashboardState>()(
  persist(
    (set, get) => ({
      quickSelect: 'last_30',
      range: initialRange,
      storeFilter: 'all',
      compareEnabled: false,
      compareSelect: 'previous_period',
      compareRange: resolveCompare(initialRange, 'previous_period'),

      setQuickSelect: (q) => {
        if (q === 'custom') {
          set({ quickSelect: q })
          return
        }
        const range = resolveQuickSelect(q)
        const { compareSelect, compareEnabled } = get()
        set({
          quickSelect: q,
          range,
          compareRange:
            compareEnabled && compareSelect !== 'custom'
              ? resolveCompare(range, compareSelect)
              : get().compareRange,
        })
      },

      setCustomRange: (range) => {
        const { compareSelect, compareEnabled } = get()
        set({
          quickSelect: 'custom',
          range,
          compareRange:
            compareEnabled && compareSelect !== 'custom'
              ? resolveCompare(range, compareSelect)
              : get().compareRange,
        })
      },

      setStoreFilter: (s) => set({ storeFilter: s }),

      toggleCompare: (enabled) => {
        const { range, compareSelect } = get()
        set({
          compareEnabled: enabled,
          compareRange:
            enabled && compareSelect !== 'custom'
              ? resolveCompare(range, compareSelect)
              : get().compareRange,
        })
      },

      setCompareSelect: (c) => {
        const { range } = get()
        set({
          compareSelect: c,
          compareRange: c === 'custom' ? get().compareRange : resolveCompare(range, c),
        })
      },

      setCustomCompareRange: (range) =>
        set({ compareSelect: 'custom', compareRange: range }),
    }),
    { name: 'cfmfhe-dashboard' },
  ),
)
