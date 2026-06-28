'use client'

import { useEffect, useState } from 'react'
import { useDashboard } from '@/store/dashboard'

interface CachedState<T> {
  data: T | null
  loading: boolean // no data to show yet
  refreshing: boolean // background fetch in flight (data already on screen)
  note?: string
}

/**
 * Stale-while-revalidate fetch with localStorage persistence. On mount it shows
 * the last cached value instantly (loading=false) and refreshes in the
 * background (refreshing=true); when there's no cache it shows loading=true so
 * the caller can render a skeleton. Re-fetches when the global refresh signal
 * (dashboard.dataVersion) changes. The response is expected to be a
 * DataEnvelope-like object ({ data, note }) or any JSON; pass `pick` to extract
 * the slice you want to cache/return.
 */
export function useCachedData<T>(
  cacheKey: string,
  url: string,
  pick: (json: any) => { data: T; note?: string } = (j) => ({ data: j?.data ?? j, note: j?.note }),
): CachedState<T> & { refresh: () => void } {
  const dataVersion = useDashboard((s) => s.dataVersion)
  const refreshData = useDashboard((s) => s.refreshData)
  const storeKey = `cfmfhe-cache:${cacheKey}`
  const [state, setState] = useState<CachedState<T>>({ data: null, loading: true, refreshing: false })

  // Hydrate from cache immediately.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey)
      if (raw) {
        const parsed = JSON.parse(raw) as { data: T; note?: string }
        setState((s) => ({ ...s, data: parsed.data, note: parsed.note, loading: false }))
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey])

  // Fetch fresh on mount, when the URL changes, or on manual refresh.
  useEffect(() => {
    let active = true
    setState((s) => ({ ...s, refreshing: true }))
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (!active) return
        const { data, note } = pick(json)
        setState({ data, note, loading: false, refreshing: false })
        try {
          localStorage.setItem(storeKey, JSON.stringify({ data, note }))
        } catch {
          /* non-fatal */
        }
      })
      .catch(() => {
        if (active) setState((s) => ({ ...s, refreshing: false, loading: false }))
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, dataVersion])

  return { ...state, refresh: refreshData }
}
