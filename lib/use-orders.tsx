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

/** Orders filtered by the active primary date range + store filter. */
export function useFilteredOrders(): Order[] {
  const { allOrders } = useContext(OrdersContext)
  const { range, storeFilter } = useDashboard()
  return useMemo(
    () =>
      filterOrders(allOrders, {
        from: range.from,
        to: range.to,
        source: storeFilter,
      }),
    [allOrders, range.from, range.to, storeFilter],
  )
}

/** Orders filtered by store only (for rolling 12-month charts). */
export function useStoreOrders(): Order[] {
  const { allOrders } = useContext(OrdersContext)
  const { storeFilter } = useDashboard()
  return useMemo(
    () => filterOrders(allOrders, { source: storeFilter }),
    [allOrders, storeFilter],
  )
}

/** Orders filtered by the comparison range (when compare is enabled). */
export function useCompareOrders(): Order[] | null {
  const { allOrders } = useContext(OrdersContext)
  const { compareEnabled, compareRange, storeFilter } = useDashboard()
  return useMemo(() => {
    if (!compareEnabled || !compareRange) return null
    return filterOrders(allOrders, {
      from: compareRange.from,
      to: compareRange.to,
      source: storeFilter,
    })
  }, [allOrders, compareEnabled, compareRange, storeFilter])
}
