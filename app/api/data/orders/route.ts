import { NextResponse } from 'next/server'
import { getOrders } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function GET() {
  const envelope = await getOrders()
  return NextResponse.json(envelope)
}
