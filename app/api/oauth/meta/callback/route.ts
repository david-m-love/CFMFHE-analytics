import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, authEnabled } from '@/lib/auth'
import { resolveCredential } from '@/lib/credentials'
import { mergeCredential } from '@/lib/ads'

export const dynamic = 'force-dynamic'

const META_GRAPH = 'https://graph.facebook.com/v21.0'

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
    .find((c) => c.startsWith('meta_oauth_state='))
    ?.split('=')[1]

  if (!code) return done('meta-error')
  if (!state || state !== cookieState) return done('state-mismatch')

  const v = await resolveCredential('meta')
  if (!v.appId || !v.appSecret) return done('missing-meta-app-id')

  try {
    const redirectUri = `${origin}/api/oauth/meta/callback`
    // 1) code → short-lived token
    const tokenRes = await fetch(
      `${META_GRAPH}/oauth/access_token?client_id=${encodeURIComponent(v.appId)}` +
        `&client_secret=${encodeURIComponent(v.appSecret)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`,
      { headers: { accept: 'application/json' } },
    )
    if (!tokenRes.ok) return done('meta-error')
    const short = (await tokenRes.json()) as { access_token?: string }
    if (!short.access_token) return done('meta-error')

    // 2) short-lived → long-lived token (≈60 days)
    const longRes = await fetch(
      `${META_GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
        `&client_id=${encodeURIComponent(v.appId)}&client_secret=${encodeURIComponent(v.appSecret)}` +
        `&fb_exchange_token=${encodeURIComponent(short.access_token)}`,
      { headers: { accept: 'application/json' } },
    )
    const long = longRes.ok ? ((await longRes.json()) as { access_token?: string }) : null
    const accessToken = long?.access_token ?? short.access_token

    await mergeCredential('meta', { accessToken })
    const res = done('meta-connected')
    res.cookies.set('meta_oauth_state', '', { maxAge: 0, path: '/' })
    return res
  } catch (e) {
    console.error('[meta] callback failed:', e)
    return done('meta-error')
  }
}
