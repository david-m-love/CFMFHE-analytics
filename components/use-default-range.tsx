'use client'

import { useEffect } from 'react'
import { useDashboard } from '@/store/dashboard'
import type { QuickSelect } from '@/lib/date-ranges'

/**
 * Applies a recommended quick-select range ONCE per browser session per key,
 * so a dashboard (e.g. CEO → last 7 days) opens on its preferred window without
 * fighting the user's manual choice on every visit.
 */
export function useDefaultRange(key: string, preset: QuickSelect) {
  const setQuickSelect = useDashboard((s) => s.setQuickSelect)
  useEffect(() => {
    const flag = `cfmfhe-default-applied:${key}`
    if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(flag)) {
      sessionStorage.setItem(flag, '1')
      setQuickSelect(preset)
    }
  }, [key, preset, setQuickSelect])
}
