import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions, authEnabled } from '@/lib/auth'
import { resolveCredential } from '@/lib/credentials'
import { META_AUTHORIZE_URL, META_SCOPE } from '@/lib/ads'

export const dynamic = 'force-dynamic'

function appOrigin(request: Request): string {
  return process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
}

export async function GET(request: Request) {
  if (authEnabled()) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.redirect(`${appOrigin(request)}/login`)
  }
  const v = await resolveCredential('meta')
  const origin = appOrigin(request)
  if (!v.appId) return NextResponse.redirect(`${origin}/connections?ads=missing-meta-app-id`)

  const state = randomBytes(16).toString('hex')
  const redirectUri = `${origin}/api/oauth/meta/callback`
  const url = new URL(META_AUTHORIZE_URL)
  url.searchParams.set('client_id', v.appId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', META_SCOPE)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)

  const res = NextResponse.redirect(url.toString())
  res.cookies.set('meta_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
