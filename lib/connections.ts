import { google } from 'googleapis'
import { JWT } from 'google-auth-library'
import { type ConnId, CONNECTION_DEFS, CONNECTION_ORDER } from './connection-defs'
import { credentialSource, resolveCredential } from './credentials'
import { testShopify } from './shopify'

export type { ConnId } from './connection-defs'
export { CONNECTION_ORDER } from './connection-defs'

export type ConnStatus = 'connected' | 'not_configured' | 'error'

export interface ConnResult {
  id: ConnId
  label: string
  description: string
  status: ConnStatus
  detail?: string
  fix?: string
  source: 'stored' | 'env' | 'none'
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

function now() {
  return new Date().toISOString()
}

function errMessage(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === 'AbortError') return 'Timed out reaching the service.'
    return e.message.slice(0, 160)
  }
  return 'Unknown error.'
}

function meta(id: ConnId) {
  const d = CONNECTION_DEFS[id]
  return { id, label: d.label, description: d.description }
}

async function testSheets(): Promise<ConnResult> {
  const m = meta('sheets')
  const source = await credentialSource('sheets')
  const v = await resolveCredential('sheets')
  if (!v.clientEmail || !v.privateKey || (!v.woocommerceSheetId && !v.shopifySheetId)) {
    return {
      ...m,
      status: 'not_configured',
      source,
      detail: 'Running on sample data.',
      fix: 'Add the service-account email, private key, and at least one sheet ID.',
      checkedAt: now(),
    }
  }
  try {
    const auth = new google.auth.JWT({
      email: v.clientEmail,
      key: v.privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
    const sheets = google.sheets({ version: 'v4', auth })
    const id = (v.woocommerceSheetId ?? v.shopifySheetId) as string
    const res = await sheets.spreadsheets.get({ spreadsheetId: id, fields: 'properties.title' })
    return { ...m, status: 'connected', source, detail: `Linked to “${res.data.properties?.title ?? 'spreadsheet'}”.`, checkedAt: now() }
  } catch (e) {
    return {
      ...m,
      status: 'error',
      source,
      detail: errMessage(e),
      fix: 'Confirm the sheet is shared with the service-account email and the ID is correct.',
      checkedAt: now(),
    }
  }
}

async function testShopifyConn(): Promise<ConnResult> {
  const m = meta('shopify')
  const source = await credentialSource('shopify')
  const v = await resolveCredential('shopify')
  if (!v.storeDomain || !v.accessToken) {
    return {
      ...m,
      status: 'not_configured',
      source,
      fix: 'Add your Shopify store domain and an Admin API access token.',
      checkedAt: now(),
    }
  }
  const res = await testShopify(v.storeDomain, v.accessToken)
  if (!res.ok) {
    return {
      ...m,
      status: 'error',
      source,
      detail: res.error ?? 'Connection failed.',
      fix: 'Check the store domain and that the custom app is installed with read_orders.',
      checkedAt: now(),
    }
  }
  return { ...m, status: 'connected', source, detail: res.name ? `Store: ${res.name}.` : 'Connected.', checkedAt: now() }
}

async function testKlaviyo(): Promise<ConnResult> {
  const m = meta('klaviyo')
  const source = await credentialSource('klaviyo')
  const v = await resolveCredential('klaviyo')
  if (!v.apiKey) {
    return { ...m, status: 'not_configured', source, fix: 'Add a Klaviyo private API key.', checkedAt: now() }
  }
  try {
    const res = await fetchWithTimeout('https://a.klaviyo.com/api/accounts/', {
      headers: { Authorization: `Klaviyo-API-Key ${v.apiKey}`, revision: '2024-10-15', accept: 'application/json' },
    })
    if (res.status === 401 || res.status === 403) {
      return { ...m, status: 'error', source, detail: 'API key rejected (401/403).', fix: 'Generate a fresh private API key and re-enter it.', checkedAt: now() }
    }
    if (!res.ok) return { ...m, status: 'error', source, detail: `Klaviyo returned ${res.status}.`, checkedAt: now() }
    const json = (await res.json()) as {
      data?: { attributes?: { contact_information?: { organization_name?: string } } }[]
    }
    const org = json.data?.[0]?.attributes?.contact_information?.organization_name
    return { ...m, status: 'connected', source, detail: org ? `Account: ${org}.` : 'API key valid.', checkedAt: now() }
  } catch (e) {
    return { ...m, status: 'error', source, detail: errMessage(e), checkedAt: now() }
  }
}

async function testGa4(): Promise<ConnResult> {
  const m = meta('ga4')
  const source = await credentialSource('ga4')
  const v = await resolveCredential('ga4')
  if (!v.clientEmail || !v.privateKey || !v.propertyId) {
    return { ...m, status: 'not_configured', source, fix: 'Add the GA4 service-account email, private key, and property ID.', checkedAt: now() }
  }
  try {
    const jwt = new JWT({
      email: v.clientEmail,
      key: v.privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    })
    const { token } = await jwt.getAccessToken()
    const res = await fetchWithTimeout(
      `https://analyticsdata.googleapis.com/v1beta/properties/${v.propertyId}/metadata`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) {
      return { ...m, status: 'error', source, detail: `GA4 API returned ${res.status}.`, fix: `Confirm the service account has access to property ${v.propertyId}.`, checkedAt: now() }
    }
    return { ...m, status: 'connected', source, detail: `Property ${v.propertyId} reachable.`, checkedAt: now() }
  } catch (e) {
    return { ...m, status: 'error', source, detail: errMessage(e), checkedAt: now() }
  }
}

async function testAnthropic(): Promise<ConnResult> {
  const m = meta('anthropic')
  const source = await credentialSource('anthropic')
  const v = await resolveCredential('anthropic')
  if (!v.apiKey) {
    return { ...m, status: 'not_configured', source, fix: 'Add an Anthropic API key to enable the AI assistant.', checkedAt: now() }
  }
  try {
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': v.apiKey, 'anthropic-version': '2023-06-01' },
    })
    if (res.status === 401) return { ...m, status: 'error', source, detail: 'API key rejected (401).', fix: 'Re-enter a valid Anthropic API key.', checkedAt: now() }
    if (!res.ok) return { ...m, status: 'error', source, detail: `Anthropic returned ${res.status}.`, checkedAt: now() }
    return { ...m, status: 'connected', source, detail: 'API key valid.', checkedAt: now() }
  } catch (e) {
    return { ...m, status: 'error', source, detail: errMessage(e), checkedAt: now() }
  }
}

const TESTS: Record<ConnId, () => Promise<ConnResult>> = {
  sheets: testSheets,
  shopify: testShopifyConn,
  klaviyo: testKlaviyo,
  ga4: testGa4,
  anthropic: testAnthropic,
}

export async function testConnection(id: ConnId): Promise<ConnResult> {
  return TESTS[id]()
}

export async function testAllConnections(): Promise<ConnResult[]> {
  return Promise.all(CONNECTION_ORDER.map((id) => TESTS[id]()))
}
