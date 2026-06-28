'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { DataEnvelope, Order, SourceStatus } from '@/types'
import { useDashboard } from '@/store/dashboard'
import { filterOrders } from '@/lib/orders'

interface OrdersContextValue {
  status: SourceStatus
  updatedAt: string | null
  note?: string
  loading: boolean // true only when there's no data to show yet
  refreshing: boolean // a background fetch is in flight (data already on screen)
  allOrders: Order[]
}

const OrdersContext = createContext<OrdersContextValue>({
  status: 'mock',
  updatedAt: null,
  loading: true,
  refreshing: false,
  allOrders: [],
})

const ORDERS_CACHE_KEY = 'cfmfhe-orders-cache'

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const dataVersion = useDashboard((s) => s.dataVersion)
  const [state, setState] = useState<OrdersContextValue>({
    status: 'mock',
    updatedAt: null,
    loading: true,
    refreshing: false,
    allOrders: [],
  })

  // Hydrate instantly from the last cached response (stale-while-revalidate).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDERS_CACHE_KEY)
      if (raw) {
        const env = JSON.parse(raw) as DataEnvelope<Order[]>
        setState((s) => ({
          ...s,
          status: env.status,
          updatedAt: env.updatedAt,
          note: env.note,
          allOrders: env.data,
          loading: false,
        }))
      }
    } catch {
      /* ignore corrupt cache */
    }
  }, [])

  // Fetch fresh on mount and whenever a manual refresh is triggered.
  useEffect(() => {
    let active = true
    setState((s) => ({ ...s, refreshing: true }))
    fetch('/api/data/orders', { cache: 'no-store' })
      .then((r) => r.json() as Promise<DataEnvelope<Order[]>>)
      .then((env) => {
        if (!active) return
        setState({
          status: env.status,
          updatedAt: env.updatedAt,
          note: env.note,
          loading: false,
          refreshing: false,
          allOrders: env.data,
        })
        try {
          localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(env))
        } catch {
          /* quota / disabled storage — non-fatal */
        }
      })
      .catch(() => {
        if (active) setState((s) => ({ ...s, refreshing: false, loading: false }))
      })
    return () => {
      active = false
    }
  }, [dataVersion])

  return <OrdersContext.Provider value={state}>{children}</OrdersContext.Provider>
}

export function useOrdersMeta() {
  return useContext(OrdersContext)
}

function excludeSources(orders: Order[], excluded: string[]): Order[] {
  return excluded.length ? orders.filter((o) => !excluded.includes(o.source)) : orders
}

/** Orders for the active date range, across all included data sources. */
export function useFilteredOrders(): Order[] {
  const { allOrders } = useContext(OrdersContext)
  const { range, excludedSources } = useDashboard()
  return useMemo(
    () =>
      excludeSources(
        filterOrders(allOrders, { from: range.from, to: range.to }),
        excludedSources,
      ),
    [allOrders, range.from, range.to, excludedSources],
  )
}

/** All-time orders (for rolling 12-month charts), across included sources. */
export function useStoreOrders(): Order[] {
  const { allOrders } = useContext(OrdersContext)
  const { excludedSources } = useDashboard()
  return useMemo(
    () => excludeSources(allOrders, excludedSources),
    [allOrders, excludedSources],
  )
}

/** Orders for the comparison range (when compare is enabled). */
export function useCompareOrders(): Order[] | null {
  const { allOrders } = useContext(OrdersContext)
  const { compareEnabled, compareRange, excludedSources } = useDashboard()
  return useMemo(() => {
    if (!compareEnabled || !compareRange) return null
    return excludeSources(
      filterOrders(allOrders, { from: compareRange.from, to: compareRange.to }),
      excludedSources,
    )
  }, [allOrders, compareEnabled, compareRange, excludedSources])
}
