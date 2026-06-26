import { google } from 'googleapis'
import type { CustomerType, DataEnvelope, Order, StoreSource } from '@/types'
import { SHEET_MAPPING } from './config'
import { buildOrder, normalizeCustomerType } from './orders'
import { getMockOrders } from './mock-data'
import { resolveCredential } from './credentials'

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
  const iType = idx(c.customerType)
  const iProducts = idx(c.products)
  const iItems = idx(c.itemsSold)
  const iNet = idx(c.netSales)
  const iCoupon = idx(c.coupon)
  const iAttr = idx(c.attribution)
  const iEmail = idx(c.email)

  const orders: Order[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length === 0) continue
    const rawDate = row[iDate] ?? ''
    const date = new Date(rawDate).toISOString().slice(0, 10)
    const customerType: CustomerType =
      iType >= 0 ? normalizeCustomerType(row[iType]) : 'unknown'
    const net = parseFloat((row[iNet] ?? '0').replace(/[^0-9.-]/g, '')) || 0
    orders.push(
      buildOrder({
        id: `${source}-${row[iId] ?? r}`,
        source,
        date,
        customerName: row[iName] ?? 'Unknown',
        customerType,
        email: iEmail >= 0 ? (row[iEmail] || null) : null,
        productNames: (row[iProducts] ?? '').split(/[,;]/).map((s) => s.trim()).filter(Boolean),
        itemsSold: parseInt(row[iItems] ?? '1', 10) || 1,
        netSales: net,
        status: row[iStatus] ?? '',
        coupon: iCoupon >= 0 ? (row[iCoupon] || null) : null,
        attribution: iAttr >= 0 ? (row[iAttr] || null) : null,
      }),
    )
  }
  return orders
}

/**
 * Returns normalized orders from both stores. Falls back to a mock dataset
 * when credentials are absent (so the app runs pre-launch), and reports a
 * "disconnected" status on hard failures rather than crashing.
 */
export async function getOrders(): Promise<DataEnvelope<Order[]>> {
  const cred = await resolveCredential('sheets')
  const wooId = cred.woocommerceSheetId
  const shopId = cred.shopifySheetId
  if (!cred.clientEmail || !cred.privateKey || (!wooId && !shopId)) {
    return {
      status: 'mock',
      updatedAt: null,
      data: getMockOrders(),
      note: 'Showing sample data — Google Sheets not yet connected (sync setup in progress).',
    }
  }

  try {
    const sheets = sheetsClient(cred.clientEmail, cred.privateKey)
    const all: Order[] = []

    if (wooId) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: wooId,
        range: SHEET_MAPPING.woocommerce.tab,
      })
      all.push(
        ...rowsToOrders(
          (res.data.values as string[][]) ?? [],
          'cfmfhe',
          SHEET_MAPPING.woocommerce,
        ),
      )
    }

    if (shopId) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: shopId,
        range: SHEET_MAPPING.shopify.tab,
      })
      all.push(
        ...rowsToOrders(
          (res.data.values as string[][]) ?? [],
          'ec',
          SHEET_MAPPING.shopify,
        ),
      )
    }

    return { status: 'connected', updatedAt: new Date().toISOString(), data: all }
  } catch (err) {
    console.error('[sheets] failed to load orders:', err)
    return {
      status: 'disconnected',
      updatedAt: null,
      data: [],
      note: 'Google Sheets data source is unavailable right now.',
    }
  }
}
