import { google } from 'googleapis'
import { JWT } from 'google-auth-library'

// Live health checks for each data source. These run server-side and make a
// lightweight authenticated call per platform. Nothing is stored — this only
// reports whether a connection is firing (green), unconfigured (amber), or
// broken (red), with a hint on how to repair it.

export type ConnStatus = 'connected' | 'not_configured' | 'error'

export type ConnId = 'sheets' | 'klaviyo' | 'ga4' | 'anthropic'

export interface ConnResult {
  id: ConnId
  label: string
  description: string
  status: ConnStatus
  detail?: string
  fix?: string
  checkedAt: string
}

const TIMEOUT_MS = 8000

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

function base(
  id: ConnId,
  label: string,
  description: string,
): Omit<ConnResult, 'status' | 'checkedAt'> {
  return { id, label, description }
}

function now() {
  return new Date().toISOString()
}

// ── Google Sheets (order data) ─────────────────────────────────────
async function testSheets(): Promise<ConnResult> {
  const meta = base(
    'sheets',
    'Google Sheets',
    'Order history from WooCommerce + Shopify',
  )
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY
  const wooId = process.env.GOOGLE_SHEETS_WOOCOMMERCE_SHEET_ID
  const shopId = process.env.GOOGLE_SHEETS_SHOPIFY_SHEET_ID

  if (!email || !key || (!wooId && !shopId)) {
    return {
      ...meta,
      status: 'not_configured',
      detail: 'Running on sample data.',
      fix: 'Add the service-account email, private key, and sheet ID(s). Share each sheet with the service-account email (Viewer).',
      checkedAt: now(),
    }
  }
  try {
    const auth = new google.auth.JWT({
      email,
      key: key.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
    const sheets = google.sheets({ version: 'v4', auth })
    const id = (wooId ?? shopId) as string
    const res = await sheets.spreadsheets.get({
      spreadsheetId: id,
      fields: 'properties.title',
    })
    return {
      ...meta,
      status: 'connected',
      detail: `Linked to “${res.data.properties?.title ?? 'spreadsheet'}”.`,
      checkedAt: now(),
    }
  } catch (e) {
    return {
      ...meta,
      status: 'error',
      detail: errMessage(e),
      fix: 'Confirm the sheet is shared with the service-account email and the sheet ID is correct.',
      checkedAt: now(),
    }
  }
}

// ── Klaviyo (email / SMS) ──────────────────────────────────────────
async function testKlaviyo(): Promise<ConnResult> {
  const meta = base('klaviyo', 'Klaviyo', 'Email & SMS subscribers and flows')
  const key = process.env.KLAVIYO_API_KEY
  if (!key) {
    return {
      ...meta,
      status: 'not_configured',
      fix: 'Add a Klaviyo private API key (account Vs3idx / klaviyo_blamer-balter).',
      checkedAt: now(),
    }
  }
  try {
    const res = await fetchWithTimeout('https://a.klaviyo.com/api/accounts/', {
      headers: {
        Authorization: `Klaviyo-API-Key ${key}`,
        revision: '2024-10-15',
        accept: 'application/json',
      },
    })
    if (res.status === 401 || res.status === 403) {
      return {
        ...meta,
        status: 'error',
        detail: 'API key rejected (401/403).',
        fix: 'Generate a fresh private API key in Klaviyo and re-enter it.',
        checkedAt: now(),
      }
    }
    if (!res.ok) {
      return {
        ...meta,
        status: 'error',
        detail: `Klaviyo returned ${res.status}.`,
        checkedAt: now(),
      }
    }
    const json = (await res.json()) as {
      data?: { attributes?: { contact_information?: { organization_name?: string } } }[]
    }
    const org = json.data?.[0]?.attributes?.contact_information?.organization_name
    return {
      ...meta,
      status: 'connected',
      detail: org ? `Account: ${org}.` : 'API key valid.',
      checkedAt: now(),
    }
  } catch (e) {
    return { ...meta, status: 'error', detail: errMessage(e), checkedAt: now() }
  }
}

// ── Google Analytics 4 (traffic) ───────────────────────────────────
async function testGa4(): Promise<ConnResult> {
  const meta = base('ga4', 'Google Analytics 4', 'Website sessions & traffic sources')
  const email = process.env.GA4_CLIENT_EMAIL
  const key = process.env.GA4_PRIVATE_KEY
  const prop = process.env.GA4_PROPERTY_ID
  if (!email || !key || !prop) {
    return {
      ...meta,
      status: 'not_configured',
      fix: 'Add the GA4 service-account email, private key, and property ID. Grant the service account Viewer on the GA4 property.',
      checkedAt: now(),
    }
  }
  try {
    const client = new JWT({
      email,
      key: key.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    })
    const { token } = await client.getAccessToken()
    const res = await fetchWithTimeout(
      `https://analyticsdata.googleapis.com/v1beta/properties/${prop}/metadata`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) {
      return {
        ...meta,
        status: 'error',
        detail: `GA4 API returned ${res.status}.`,
        fix: 'Confirm the service account has access to property ' + prop + '.',
        checkedAt: now(),
      }
    }
    return {
      ...meta,
      status: 'connected',
      detail: `Property ${prop} reachable.`,
      checkedAt: now(),
    }
  } catch (e) {
    return { ...meta, status: 'error', detail: errMessage(e), checkedAt: now() }
  }
}

// ── Anthropic (AI Ask Anything) ────────────────────────────────────
async function testAnthropic(): Promise<ConnResult> {
  const meta = base('anthropic', 'Anthropic (Claude)', 'Powers the Ask Anything assistant')
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return {
      ...meta,
      status: 'not_configured',
      fix: 'Add an Anthropic API key to enable the AI assistant.',
      checkedAt: now(),
    }
  }
  try {
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    })
    if (res.status === 401) {
      return {
        ...meta,
        status: 'error',
        detail: 'API key rejected (401).',
        fix: 'Re-enter a valid Anthropic API key.',
        checkedAt: now(),
      }
    }
    if (!res.ok) {
      return {
        ...meta,
        status: 'error',
        detail: `Anthropic returned ${res.status}.`,
        checkedAt: now(),
      }
    }
    return { ...meta, status: 'connected', detail: 'API key valid.', checkedAt: now() }
  } catch (e) {
    return { ...meta, status: 'error', detail: errMessage(e), checkedAt: now() }
  }
}

function errMessage(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === 'AbortError') return 'Timed out reaching the service.'
    return e.message.slice(0, 160)
  }
  return 'Unknown error.'
}

const TESTS: Record<ConnId, () => Promise<ConnResult>> = {
  sheets: testSheets,
  klaviyo: testKlaviyo,
  ga4: testGa4,
  anthropic: testAnthropic,
}

export const CONNECTION_ORDER: ConnId[] = ['sheets', 'klaviyo', 'ga4', 'anthropic']

export async function testConnection(id: ConnId): Promise<ConnResult> {
  return TESTS[id]()
}

export async function testAllConnections(): Promise<ConnResult[]> {
  return Promise.all(CONNECTION_ORDER.map((id) => TESTS[id]()))
}
