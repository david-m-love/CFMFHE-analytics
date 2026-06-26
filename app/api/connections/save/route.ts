import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, authEnabled, secureModeEnabled } from '@/lib/auth'
import { encryptionConfigured } from '@/lib/crypto'
import { CONNECTION_DEFS, type ConnId } from '@/lib/connection-defs'
import { clearStoredCredential, saveCredential } from '@/lib/credentials-store'
import { testConnection } from '@/lib/connections'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // Storing real credentials requires login + an encryption key.
  if (!authEnabled()) {
    return NextResponse.json({ error: 'Enable login (set DASHBOARD_USERS) first.' }, { status: 403 })
  }
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!encryptionConfigured()) {
    return NextResponse.json({ error: 'Set APP_ENCRYPTION_KEY to store credentials.' }, { status: 400 })
  }
  if (!secureModeEnabled()) {
    return NextResponse.json({ error: 'Secure mode is not fully configured.' }, { status: 400 })
  }

  const body = (await request.json()) as {
    id?: ConnId
    action?: 'save' | 'clear'
    fields?: Record<string, string>
  }
  const id = body.id
  if (!id || !CONNECTION_DEFS[id]) {
    return NextResponse.json({ error: 'Unknown connection.' }, { status: 400 })
  }

  if (body.action === 'clear') {
    await clearStoredCredential(id)
    return NextResponse.json({ result: await testConnection(id) })
  }

  // keep only known, non-empty fields
  const allowed = new Set(CONNECTION_DEFS[id].fields.map((f) => f.key))
  const fields: Record<string, string> = {}
  for (const [k, v] of Object.entries(body.fields ?? {})) {
    if (allowed.has(k) && typeof v === 'string' && v.trim()) fields[k] = v.trim()
  }
  if (!Object.keys(fields).length) {
    return NextResponse.json({ error: 'No values provided.' }, { status: 400 })
  }

  await saveCredential(id, fields)
  return NextResponse.json({ result: await testConnection(id) })
}
