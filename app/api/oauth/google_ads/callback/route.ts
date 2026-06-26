import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, authEnabled } from '@/lib/auth'
import { resolveCredential } from '@/lib/credentials'
import { mergeCredential, GOOGLE_TOKEN_URL } from '@/lib/ads'

export const dynamic = 'force-dynamic'

function appOrigin(request: Request): string {
  return process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
}

export async function GET(request: Request) {
  const origin = appOrigin(request)
  const done = (status: string) => NextResponse.redirect(`${origin}/connections?ads=${status}`)

  if (authEnabled()) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.redirect(`${origin}/login`)
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('gads_oauth_state='))
    ?.split('=')[1]

  if (!code) return done('google-error')
  if (!state || state !== cookieState) return done('state-mismatch')

  const v = await resolveCredential('google_ads')
  if (!v.clientId || !v.clientSecret) return done('missing-google-client-id')

  try {
    const redirectUri = `${origin}/api/oauth/google_ads/callback`
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        client_id: v.clientId,
        client_secret: v.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) return done('google-error')
    const tokens = (await tokenRes.json()) as { refresh_token?: string; access_token?: string }
    if (!tokens.refresh_token) {
      // Google only returns a refresh token on first consent; prompt=consent forces it.
      return done('google-no-refresh')
    }
    await mergeCredential('google_ads', { refreshToken: tokens.refresh_token })
    const res = done('google-connected')
    res.cookies.set('gads_oauth_state', '', { maxAge: 0, path: '/' })
    return res
  } catch (e) {
    console.error('[google_ads] callback failed:', e)
    return done('google-error')
  }
}
