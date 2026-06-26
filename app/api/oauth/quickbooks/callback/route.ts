import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, authEnabled } from '@/lib/auth'
import { resolveCredential } from '@/lib/credentials'
import { exchangeCodeForTokens, mergeQuickbooksCredential } from '@/lib/quickbooks'

export const dynamic = 'force-dynamic'

function appOrigin(request: Request): string {
  return process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
}

export async function GET(request: Request) {
  const origin = appOrigin(request)
  const done = (status: string) => NextResponse.redirect(`${origin}/connections?qb=${status}`)

  if (authEnabled()) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.redirect(`${origin}/login`)
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const realmId = url.searchParams.get('realmId')
  const state = url.searchParams.get('state')
  const cookieState = request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('qb_oauth_state='))
    ?.split('=')[1]

  if (!code || !realmId) return done('error')
  if (!state || state !== cookieState) return done('state-mismatch')

  const v = await resolveCredential('quickbooks')
  if (!v.clientId || !v.clientSecret) return done('missing-client-id')

  try {
    const redirectUri = `${origin}/api/oauth/quickbooks/callback`
    const tokens = await exchangeCodeForTokens(v.clientId, v.clientSecret, code, redirectUri)
    await mergeQuickbooksCredential({
      realmId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    })
    const res = done('connected')
    res.cookies.set('qb_oauth_state', '', { maxAge: 0, path: '/' })
    return res
  } catch (e) {
    console.error('[quickbooks] callback failed:', e)
    return done('error')
  }
}
