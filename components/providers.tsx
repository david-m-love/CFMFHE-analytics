'use client'

import { SessionProvider } from 'next-auth/react'
import { OrdersProvider } from '@/lib/use-orders'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <OrdersProvider>{children}</OrdersProvider>
    </SessionProvider>
  )
}
