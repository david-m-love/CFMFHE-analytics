import { google } from 'googleapis'
import type { CustomerType, Order, StoreSource } from '@/types'
import { SHEET_MAPPING } from './config'
import { buildOrder, normalizeCustomerType } from './orders'
import { resolveCredential } from './credentials'

/**
 * Build an A1-notation range from a tab name. Sheet titles with spaces or
 * special characters must be wrapped in single quotes (internal quotes doubled),
 * otherwise the Sheets API returns "Unable to parse range".
 */
function rangeForTab(tab: string): string {
  return /^[A-Za-z0-9_]+$/.test(tab) ? tab : `'${tab.replace(/'/g, "''")}'`
}

function sheetsClient(clientEmail: string, privateKey: string) {
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  return google.sheets({ version: 'v4', auth })
}

function rowsToOrders(
  rows: string[][],
  source: StoreSource,
  mapping: (typeof SHEET_MAPPING)['woocommerce' | 'shopify'],
): Order[] {
  if (rows.length < 2) return []
  const header = rows[0]
  const idx = (col: string | null) =>
    col == null ? -1 : header.findIndex((h) => h.trim() === col)

  const c = mapping.columns
  const iDate = idx(c.date)
  const iId = idx(c.orderId)
  const iStatus = idx(c.status)
  const iName = idx(c.customerName)
  const iFirst = idx(c.customerFirstName ?? null)
  const iLast = idx(c.customerLastName ?? null)
  const iType = idx(c.customerType)
  const iCustOrders = idx(c.customerTotalOrders ?? null)
  const iProducts = idx(c.products)
  const iItems = idx(c.itemsSold)
  const iNet = idx(c.netSales)
  const iCoupon = idx(c.coupon)
  const iAttr = idx(c.attribution)
  const iEmail = idx(c.email)
  const iWcType = idx(c.wcProductType ?? null)
  const iSku = idx(c.sku ?? null)
  const iCategories = idx(c.categories ?? null)
  const iVariation = idx(c.variation ?? null)

  // Exports are line-item level (one row per product). Group rows that share an
  // Order Id back into a single order so order counts / AOV are accurate and a
  // multi-product order isn't counted as several orders. Revenue is summed
  // across the order's lines; quantity summed; products collected; the order's
  // scalar fields (date, customer, email, status, coupon, attribution) come
  // from its first line.
  interface Group {
    orderId: string
    date: string
    customerName: string
    customerType: CustomerType
    email: string | null
    productNames: string[]
    itemsSold: number
    netSales: number
    status: string
    coupon: string | null
    attribution: string | null
    classifyHint: string
  }
  const groups = new Map<string, Group>()

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length === 0) continue
    const rawDate = row[iDate] ?? ''
    const parsed = new Date(rawDate)
    if (isNaN(parsed.getTime())) continue // skip rows without a usable date
    const date = parsed.toISOString().slice(0, 10)

    const orderId = (iId >= 0 ? row[iId] : '')?.trim() || `row-${r}`
    const key = `${source}-${orderId}`

    const lineNet = parseFloat((row[iNet] ?? '0').replace(/[^0-9.-]/g, '')) || 0
    const lineQty = parseInt(row[iItems] ?? '1', 10) || 1
    const lineProducts = (row[iProducts] ?? '')
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)

    const existing = groups.get(key)
    if (existing) {
      existing.netSales += lineNet
      existing.itemsSold += lineQty
      existing.productNames.push(...lineProducts)
      if (!existing.email && iEmail >= 0 && row[iEmail]) existing.email = row[iEmail]
      continue
    }

    // First line of this order — capture its scalar fields.
    let customerType: CustomerType =
      iType >= 0 ? normalizeCustomerType(row[iType]) : 'unknown'
    if (customerType === 'unknown' && iCustOrders >= 0) {
      const n = parseInt((row[iCustOrders] ?? '').replace(/[^0-9]/g, ''), 10)
      if (n === 1) customerType = 'new'
      else if (n > 1) customerType = 'returning'
    }

    let customerName = (iName >= 0 ? row[iName] : '') || ''
    if (!customerName && (iFirst >= 0 || iLast >= 0)) {
      customerName = [iFirst >= 0 ? row[iFirst] : '', iLast >= 0 ? row[iLast] : '']
        .filter(Boolean)
        .join(' ')
        .trim()
    }

    groups.set(key, {
      orderId,
      date,
      customerName: customerName || 'Unknown',
      customerType,
      email: iEmail >= 0 ? (row[iEmail] || null) : null,
      productNames: lineProducts,
      itemsSold: lineQty,
      netSales: lineNet,
      status: iStatus >= 0 ? (row[iStatus] ?? '') : 'Completed',
      coupon: iCoupon >= 0 ? (row[iCoupon] || null) : null,
      attribution: iAttr >= 0 ? (row[iAttr] || null) : null,
      classifyHint: [
        iVariation >= 0 ? row[iVariation] : '',
        iCategories >= 0 ? row[iCategories] : '',
        iSku >= 0 ? row[iSku] : '',
        iWcType >= 0 ? row[iWcType] : '',
      ]
        .filter(Boolean)
        .join(' '),
    })
  }

  return [...groups.values()].map((g) =>
    buildOrder({
      id: `${source}-${g.orderId}`,
      source,
      date: g.date,
      customerName: g.customerName,
      customerType: g.customerType,
      email: g.email,
      productNames: g.productNames.length ? g.productNames : ['Unknown product'],
      itemsSold: g.itemsSold,
      netSales: Math.round(g.netSales * 100) / 100,
      status: g.status,
      coupon: g.coupon,
      attribution: g.attribution,
      classifyHint: g.classifyHint,
    }),
  )
}

/**
 * Order data from Google Sheets. `configured` is false when credentials are
 * absent. Pulls WooCommerce (cfmfhe) and, if a Shopify tab is configured here,
 * Shopify rows too. Throws on hard failure (caller decides how to degrade).
 */
export async function getSheetOrders(): Promise<{ configured: boolean; orders: Order[] }> {
  const cred = await resolveCredential('sheets')
  const wooId = cred.woocommerceSheetId
  const shopId = cred.shopifySheetId
  if (!cred.clientEmail || !cred.privateKey || (!wooId && !shopId)) {
    return { configured: false, orders: [] }
  }

  const sheets = sheetsClient(cred.clientEmail, cred.privateKey)
  const all: Order[] = []
  if (wooId) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: wooId, range: rangeForTab(SHEET_MAPPING.woocommerce.tab) })
    all.push(...rowsToOrders((res.data.values as string[][]) ?? [], 'cfmfhe', SHEET_MAPPING.woocommerce))
  }
  if (shopId) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: shopId, range: rangeForTab(SHEET_MAPPING.shopify.tab) })
    all.push(...rowsToOrders((res.data.values as string[][]) ?? [], 'ec', SHEET_MAPPING.shopify))
  }
  return { configured: true, orders: all }
}
