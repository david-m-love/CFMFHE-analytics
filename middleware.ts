import { withAuth } from 'next-auth/middleware'

// Redirect unauthenticated users to our branded login page.
export default withAuth({
  pages: { signIn: '/login' },
})

// Protect everything except the login page, auth API, and static assets.
export const config = {
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
