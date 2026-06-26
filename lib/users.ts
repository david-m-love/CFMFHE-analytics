import { decrypt, encrypt, hashPassword, verifyPassword } from './crypto'
import { kvGet, kvSet } from './credentials-store'

export type Role = 'admin' | 'user'

interface StoredUser {
  name: string
  email: string
  role: Role
  passwordHash: string
}

export interface PublicUser {
  name: string
  email: string
  role: Role
  /** bootstrap users come from DASHBOARD_USERS and can't be edited/removed */
  source: 'bootstrap' | 'db'
}

export interface AuthedUser {
  name: string
  email: string
  role: Role
}

const USERS_KEY = 'users:list'

// Bootstrap admins from the DASHBOARD_USERS env var. These always work (so you
// can never lock yourself out) and are always admins.
function bootstrapUsers(): { name: string; email: string; password: string }[] {
  const raw = process.env.DASHBOARD_USERS
  if (!raw) return []
  return raw
    .split(',')
    .map((e) => e.split('|').map((s) => s.trim()))
    .filter((p) => p.length === 3)
    .map(([name, email, password]) => ({ name, email, password }))
}

async function loadDbUsers(): Promise<StoredUser[]> {
  const raw = await kvGet(USERS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(decrypt(raw)) as StoredUser[]
  } catch {
    return []
  }
}

async function saveDbUsers(users: StoredUser[]): Promise<void> {
  await kvSet(USERS_KEY, encrypt(JSON.stringify(users)))
}

const norm = (email: string) => email.trim().toLowerCase()

/** All users (bootstrap admins + DB users), bootstrap winning on conflicts. */
export async function listUsers(): Promise<PublicUser[]> {
  const boot = bootstrapUsers().map<PublicUser>((u) => ({
    name: u.name,
    email: u.email,
    role: 'admin',
    source: 'bootstrap',
  }))
  const bootEmails = new Set(boot.map((b) => norm(b.email)))
  const db = (await loadDbUsers())
    .filter((u) => !bootEmails.has(norm(u.email)))
    .map<PublicUser>((u) => ({ name: u.name, email: u.email, role: u.role, source: 'db' }))
  return [...boot, ...db]
}

/** Verify a login against bootstrap users, then DB users. */
export async function authenticate(email: string, password: string): Promise<AuthedUser | null> {
  const e = norm(email)
  const boot = bootstrapUsers().find((u) => norm(u.email) === e)
  if (boot) {
    return boot.password === password ? { name: boot.name, email: boot.email, role: 'admin' } : null
  }
  const db = await loadDbUsers()
  const u = db.find((x) => norm(x.email) === e)
  if (u && verifyPassword(password, u.passwordHash)) {
    return { name: u.name, email: u.email, role: u.role }
  }
  return null
}

export async function addUser(input: {
  name: string
  email: string
  password: string
  role: Role
}): Promise<{ ok: boolean; error?: string }> {
  const e = norm(input.email)
  if (!input.name.trim() || !e || input.password.length < 6) {
    return { ok: false, error: 'Name, email, and a 6+ char password are required.' }
  }
  if (bootstrapUsers().some((u) => norm(u.email) === e)) {
    return { ok: false, error: 'That email is a built-in admin already.' }
  }
  const db = await loadDbUsers()
  if (db.some((u) => norm(u.email) === e)) {
    return { ok: false, error: 'A user with that email already exists.' }
  }
  db.push({
    name: input.name.trim(),
    email: input.email.trim(),
    role: input.role,
    passwordHash: hashPassword(input.password),
  })
  await saveDbUsers(db)
  return { ok: true }
}

export async function updateRole(email: string, role: Role): Promise<{ ok: boolean; error?: string }> {
  const db = await loadDbUsers()
  const u = db.find((x) => norm(x.email) === norm(email))
  if (!u) return { ok: false, error: 'User not found.' }
  u.role = role
  await saveDbUsers(db)
  return { ok: true }
}

export async function removeUser(email: string): Promise<{ ok: boolean; error?: string }> {
  const e = norm(email)
  if (bootstrapUsers().some((u) => norm(u.email) === e)) {
    return { ok: false, error: 'Built-in admins can’t be removed here (edit DASHBOARD_USERS).' }
  }
  const db = await loadDbUsers()
  const next = db.filter((u) => norm(u.email) !== e)
  if (next.length === db.length) return { ok: false, error: 'User not found.' }
  await saveDbUsers(next)
  return { ok: true }
}
