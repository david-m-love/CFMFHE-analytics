import type { DataEnvelope, SourceStatus } from '@/types'
import { resolveCredential } from './credentials'
import { getStoredCredential, saveCredential } from './credentials-store'

export const QB_AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2'
export const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
export const QB_SCOPE = 'com.intuit.quickbooks.accounting'

function apiBase(environment?: string): string {
  return environment === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com'
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

function basicAuth(clientId: string, clientSecret: string) {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
}

export async function exchangeCodeForTokens(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const res = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  })
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`)
  return res.json()
}

async function refreshTokens(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<TokenResponse> {
  const res = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error(`Token refresh failed (${res.status})`)
  return res.json()
}

/** Merge new fields into the stored quickbooks credential blob. */
export async function mergeQuickbooksCredential(patch: Record<string, string>): Promise<void> {
  const existing = (await getStoredCredential('quickbooks')) ?? {}
  await saveCredential('quickbooks', { ...existing, ...patch })
}

export interface Financials {
  cashBalance: number
  moneyIn: number
  moneyOut: number
}

async function qbFetch(url: string, token: string) {
  return fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } })
}

/** Walk a P&L report to pull total income (money in) and expenses (money out). */
function parsePnl(report: unknown): { moneyIn: number; moneyOut: number } {
  let moneyIn = 0
  let moneyOut = 0
  const rows = (report as { Rows?: { Row?: unknown[] } })?.Rows?.Row ?? []
  for (const row of rows as { group?: string; Summary?: { ColData?: { value?: string }[] } }[]) {
    const total = parseFloat(row?.Summary?.ColData?.[1]?.value ?? '0') || 0
    if (row.group === 'Income') moneyIn = total
    if (row.group === 'Expenses') moneyOut = total
  }
  return { moneyIn, moneyOut }
}

export async function getFinancials(from: string, to: string): Promise<DataEnvelope<Financials>> {
  const v = await resolveCredential('quickbooks')
  if (!v.accessToken || !v.refreshToken || !v.realmId || !v.clientId) {
    return {
      status: 'mock' as SourceStatus,
      updatedAt: null,
      data: sampleFinancials(),
      note: 'Showing sample finances — QuickBooks not connected.',
    }
  }
  const base = apiBase(v.environment)

  async function withToken(fn: (token: string) => Promise<Response>): Promise<Response> {
    let res = await fn(v.accessToken)
    if (res.status === 401) {
      // refresh and retry once
      const t = await refreshTokens(v.clientId, v.clientSecret, v.refreshToken)
      await mergeQuickbooksCredential({ accessToken: t.access_token, refreshToken: t.refresh_token })
      v.accessToken = t.access_token
      v.refreshToken = t.refresh_token
      res = await fn(t.access_token)
    }
    return res
  }

  try {
    // Cash balance: sum CurrentBalance of bank accounts
    const q = encodeURIComponent("select * from Account where AccountType = 'Bank'")
    const acctRes = await withToken((token) =>
      qbFetch(`${base}/v3/company/${v.realmId}/query?query=${q}&minorversion=70`, token),
    )
    let cashBalance = 0
    if (acctRes.ok) {
      const j = (await acctRes.json()) as { QueryResponse?: { Account?: { CurrentBalance?: number }[] } }
      cashBalance = (j.QueryResponse?.Account ?? []).reduce((s, a) => s + (a.CurrentBalance ?? 0), 0)
    }

    // Money in / out: P&L for the window
    const pnlRes = await withToken((token) =>
      qbFetch(
        `${base}/v3/company/${v.realmId}/reports/ProfitAndLoss?start_date=${from}&end_date=${to}&minorversion=70`,
        token,
      ),
    )
    let moneyIn = 0
    let moneyOut = 0
    if (pnlRes.ok) {
      ;({ moneyIn, moneyOut } = parsePnl(await pnlRes.json()))
    }

    return {
      status: 'connected',
      updatedAt: new Date().toISOString(),
      data: { cashBalance: round(cashBalance), moneyIn: round(moneyIn), moneyOut: round(moneyOut) },
    }
  } catch (e) {
    console.error('[quickbooks] failed:', e)
    return {
      status: 'disconnected',
      updatedAt: null,
      data: sampleFinancials(),
      note: 'QuickBooks is connected but the request failed — showing sample data.',
    }
  }
}

/** Lightweight connection check for the Connections page. */
export async function quickbooksConnected(): Promise<{ ok: boolean; needsAuth: boolean; error?: string }> {
  const v = await resolveCredential('quickbooks')
  if (!v.clientId || !v.clientSecret) return { ok: false, needsAuth: false }
  if (!v.accessToken || !v.realmId) return { ok: false, needsAuth: true }
  const env = await getFinancials(new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10))
  return { ok: env.status === 'connected', needsAuth: false, error: env.status === 'disconnected' ? env.note : undefined }
}

function sampleFinancials(): Financials {
  return { cashBalance: 84210, moneyIn: 31280, moneyOut: 22140 }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
