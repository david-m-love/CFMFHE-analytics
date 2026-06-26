import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { encryptionConfigured } from './crypto'

interface DashboardUser {
  email: string
  password: string
  name: string
}

/**
 * Login is OFF until DASHBOARD_USERS is configured, so deploying never locks
 * anyone out of the open preview. Format:
 *   "Name|email|password,Name2|email2|password2"
 */
export function authEnabled(): boolean {
  return !!process.env.DASHBOARD_USERS
}

/** In-app credential editing requires login AND an encryption key. */
export function secureModeEnabled(): boolean {
  return authEnabled() && encryptionConfigured()
}

function getUsers(): DashboardUser[] {
  const raw = process.env.DASHBOARD_USERS
  if (!raw) return []
  return raw
    .split(',')
    .map((entry) => entry.split('|').map((s) => s.trim()))
    .filter((parts) => parts.length === 3)
    .map(([name, email, password]) => ({ name, email, password }))
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null
        const user = getUsers().find(
          (u) =>
            u.email.toLowerCase() === credentials.email.toLowerCase() &&
            u.password === credentials.password,
        )
        if (!user) return null
        return { id: user.email, email: user.email, name: user.name }
      },
    }),
  ],
}
