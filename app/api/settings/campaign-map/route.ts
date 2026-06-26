import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, authEnabled } from '@/lib/auth'
import { getSetting, setSetting } from '@/lib/settings-store'
import type { CampaignMap } from '@/lib/campaign-mapping'

export const dynamic = 'force-dynamic'

export async function GET() {
  const map = (await getSetting<CampaignMap>('campaign-map')) ?? {}
  return NextResponse.json({ map })
}

export async function POST(request: Request) {
  if (authEnabled()) {
    const session = await getServerSession(authOptions)
    const role = (session?.user as { role?: string } | undefined)?.role
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    if (role !== 'admin') return NextResponse.json({ error: 'Admins only.' }, { status: 403 })
  }
  const body = (await request.json()) as { map?: CampaignMap }
  const clean: CampaignMap = {}
  for (const [k, v] of Object.entries(body.map ?? {})) {
    if (typeof k === 'string' && typeof v === 'string' && v.trim()) clean[k] = v.trim()
  }
  await setSetting('campaign-map', clean)
  return NextResponse.json({ map: clean })
}
