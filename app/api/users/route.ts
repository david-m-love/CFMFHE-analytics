import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, secureModeEnabled } from '@/lib/auth'
import { addUser, listUsers, removeUser, updateRole, type Role } from '@/lib/users'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session) return { error: 'Unauthorized.', status: 401 as const }
  if (role !== 'admin') return { error: 'Admins only.', status: 403 as const }
  return { ok: true as const }
}

export async function GET() {
  if (!secureModeEnabled()) return NextResponse.json({ users: [], secureMode: false })
  const gate = await requireAdmin()
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })
  return NextResponse.json({ users: await listUsers(), secureMode: true })
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const body = (await request.json()) as {
    name?: string
    email?: string
    password?: string
    role?: Role
  }
  const result = await addUser({
    name: body.name ?? '',
    email: body.email ?? '',
    password: body.password ?? '',
    role: body.role === 'admin' ? 'admin' : 'user',
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ users: await listUsers() })
}

export async function PATCH(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const body = (await request.json()) as { email?: string; role?: Role }
  if (!body.email || (body.role !== 'admin' && body.role !== 'user')) {
    return NextResponse.json({ error: 'email and role required.' }, { status: 400 })
  }
  const result = await updateRole(body.email, body.role)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ users: await listUsers() })
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const body = (await request.json()) as { email?: string }
  if (!body.email) return NextResponse.json({ error: 'email required.' }, { status: 400 })
  const result = await removeUser(body.email)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ users: await listUsers() })
}
