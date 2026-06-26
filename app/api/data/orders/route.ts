import { NextResponse } from 'next/server'
import { getOrders } from '@/lib/orders-source'

export const dynamic = 'force-dynamic'

export async function GET() {
  const envelope = await getOrders()
  return NextResponse.json(envelope)
}
