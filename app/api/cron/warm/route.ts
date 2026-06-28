import { NextResponse } from 'next/server'
import { getOrders } from '@/lib/orders-source'
import { getKlaviyoOverview } from '@/lib/klaviyo'
import { resolveQuickSelect } from '@/lib/date-ranges'

// Cache-warming endpoint. Hit on a schedule (Vercel Cron) so the heavy KV
// caches (WooCommerce/Shopify orders, Klaviyo) are already warm when someone
// opens the dashboard — turning the slow first load into a fast one.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  // If CRON_SECRET is set, require it (Vercel Cron sends it as a Bearer token).
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
  }

  const last7 = resolveQuickSelect('last_7')
  const results = await Promise.allSettled([
    getOrders(),
    getKlaviyoOverview(last7.from, last7.to),
  ])
  return NextResponse.json({
    warmed: results.map((r) => (r.status === 'fulfilled' ? 'ok' : 'failed')),
    at: new Date().toISOString(),
  })
}
