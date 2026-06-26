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
  loading: boolean
  allOrders: Order[]
}

const OrdersContext = createContext<OrdersContextValue>({
  status: 'mock',
  updatedAt: null,
  loading: true,
  allOrders: [],
})

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OrdersContextValue>({
    status: 'mock',
    updatedAt: null,
    loading: true,
    allOrders: [],
  })

  useEffect(() => {
    let active = true
    fetch('/api/data/orders')
      .then((r) => r.json() as Promise<DataEnvelope<Order[]>>)
      .then((env) => {
        if (!active) return
        setState({
          status: env.status,
          updatedAt: env.updatedAt,
          note: env.note,
          loading: false,
          allOrders: env.data,
        })
      })
      .catch(() => {
        if (active) setState((s) => ({ ...s, status: 'disconnected', loading: false }))
      })
    return () => {
      active = false
    }
  }, [])

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
