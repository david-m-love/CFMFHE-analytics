import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { encryptionConfigured } from './crypto'
import { authenticate } from './users'

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
        const user = await authenticate(credentials.email, credentials.password)
        if (!user) return null
        return { id: user.email, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user && 'role' in user) token.role = (user as { role?: string }).role
      return token
    },
    async session({ session, token }) {
      if (session.user) (session.user as { role?: string }).role = token.role as string | undefined
      return session
    },
  },
}
