import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PUBLIC = [/^\/login/, /^\/api\/auth/]

export async function middleware(req: NextRequest) {
  // Auth is disabled until DASHBOARD_USERS is set — open preview stays open.
  if (!process.env.DASHBOARD_USERS) return NextResponse.next()

  const { pathname } = req.nextUrl
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next()

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
