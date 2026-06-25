'use client'

import { OrdersProvider } from '@/lib/use-orders'

export function Providers({ children }: { children: React.ReactNode }) {
  return <OrdersProvider>{children}</OrdersProvider>
}
