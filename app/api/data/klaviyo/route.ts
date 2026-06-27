import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, authEnabled } from '@/lib/auth'
import { getKlaviyoOverview } from '@/lib/klaviyo'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // first (uncached) build pages Klaviyo sequentially

function today() {
  return new Date().toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  if (authEnabled()) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  const url = new URL(request.url)
  const from = url.searchParams.get('from') ?? today()
  const to = url.searchParams.get('to') ?? today()
  const env = await getKlaviyoOverview(from, to)
  return NextResponse.json(env)
}
