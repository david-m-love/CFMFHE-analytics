import { NextResponse } from 'next/server'
import { getTraffic } from '@/lib/ga4'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const to = url.searchParams.get('to') ?? new Date().toISOString().slice(0, 10)
  const from = url.searchParams.get('from') ?? to
  return NextResponse.json(await getTraffic(from, to))
}
