import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, authEnabled } from '@/lib/auth'
import { getSetting, setSetting } from '@/lib/settings-store'
import { DEFAULT_CMO_SETTINGS, type CmoSettings } from '@/lib/marketing'

export const dynamic = 'force-dynamic'

export async function GET() {
  const stored = await getSetting<CmoSettings>('cmo')
  return NextResponse.json({ settings: { ...DEFAULT_CMO_SETTINGS, ...(stored ?? {}) } })
}

export async function POST(request: Request) {
  if (authEnabled()) {
    const session = await getServerSession(authOptions)
    const role = (session?.user as { role?: string } | undefined)?.role
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    if (role !== 'admin') return NextResponse.json({ error: 'Admins only.' }, { status: 403 })
  }
  const body = (await request.json()) as Partial<CmoSettings>
  const next: CmoSettings = {
    cogsDefaultPct: clampPct(body.cogsDefaultPct),
    shippingPerOrder: Math.max(0, Number(body.shippingPerOrder) || 0),
    cogsOverrides: (body.cogsOverrides ?? [])
      .filter((o) => o && o.name?.trim())
      .map((o) => ({ name: o.name.trim(), pct: clampPct(o.pct) })),
    manualAdSpend: (body.manualAdSpend ?? [])
      .filter((m) => m && /^\d{4}-\d{2}$/.test(m.month))
      .map((m) => ({ month: m.month, amount: Math.max(0, Number(m.amount) || 0) })),
  }
  await setSetting('cmo', next)
  return NextResponse.json({ settings: next })
}

function clampPct(v: unknown): number {
  const n = Number(v)
  if (!isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}
