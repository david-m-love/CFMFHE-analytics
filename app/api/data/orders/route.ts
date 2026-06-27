import { NextResponse } from 'next/server'
import { getOrders } from '@/lib/orders-source'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // first (uncached) load may run a Shopify bulk job

export async function GET() {
  const envelope = await getOrders()
  return NextResponse.json(envelope)
}
