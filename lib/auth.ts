import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

interface DashboardUser {
  email: string
  password: string
  name: string
}

/**
 * Users come from the DASHBOARD_USERS env var (format:
 * "Name|email|password,Name2|email2|password2"). In non-production, a demo
 * user is seeded so previews are usable; production REQUIRES configuration.
 */
function getUsers(): DashboardUser[] {
  const raw = process.env.DASHBOARD_USERS
  if (raw) {
    return raw
      .split(',')
      .map((entry) => entry.split('|').map((s) => s.trim()))
      .filter((parts) => parts.length === 3)
      .map(([name, email, password]) => ({ name, email, password }))
  }
  if (process.env.NODE_ENV !== 'production') {
    return [{ name: 'Demo Admin', email: 'admin@cfmfhe.com', password: 'cfmfhe-demo' }]
  }
  return []
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
  },
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
