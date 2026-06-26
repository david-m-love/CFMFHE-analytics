import { NextResponse } from 'next/server'
import { getFinancials } from '@/lib/quickbooks'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const to = url.searchParams.get('to') ?? new Date().toISOString().slice(0, 10)
  const from = url.searchParams.get('from') ?? to
  return NextResponse.json(await getFinancials(from, to))
}
