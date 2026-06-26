import type { DataEnvelope, Order } from '@/types'
import { getSheetOrders } from './sheets'
import { getEcOrders } from './shopify'
import { getMockOrders } from './mock-data'

/**
 * Unified order feed. Merges WooCommerce (Google Sheets) and the EC store
 * (Shopify direct API) from whichever sources are connected. Falls back to a
 * sample dataset when nothing is connected, and degrades gracefully (returning
 * the sources that do work) if one fails.
 */
export async function getOrders(): Promise<DataEnvelope<Order[]>> {
  let sheet: { configured: boolean; orders: Order[] } = { configured: false, orders: [] }
  let sheetError = false
  try {
    sheet = await getSheetOrders()
  } catch (e) {
    console.error('[sheets] failed:', e)
    sheet = { configured: true, orders: [] }
    sheetError = true
  }

  const ec = await getEcOrders() // never throws

  if (!sheet.configured && !ec.configured) {
    return {
      status: 'mock',
      updatedAt: null,
      data: getMockOrders(),
      note: 'Showing sample data — no order source connected yet.',
    }
  }

  const orders = [...sheet.orders, ...ec.orders]
  const problems: string[] = []
  if (sheetError) problems.push('Google Sheets unavailable')
  if (ec.configured && ec.error) problems.push(`Shopify: ${ec.error}`)

  return {
    status: problems.length && orders.length === 0 ? 'disconnected' : 'connected',
    updatedAt: new Date().toISOString(),
    data: orders,
    note: problems.length ? problems.join(' · ') : undefined,
  }
}
