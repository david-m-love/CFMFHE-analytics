import type { DataEnvelope, Order } from '@/types'
import { getSheetOrders } from './sheets'
import { getWooOrders } from './woocommerce'
import { getEcOrders } from './shopify'
import { getMockOrders } from './mock-data'

/**
 * Unified order feed. comefollowmefhe.com orders come from the WooCommerce
 * REST API (primary); if that isn't configured or fails, Google Sheets is the
 * automatic backup. The EC store comes from Shopify. Falls back to sample data
 * when nothing is connected, and degrades gracefully if a source fails.
 */
export async function getOrders(): Promise<DataEnvelope<Order[]>> {
  const problems: string[] = []

  // ── comefollowmefhe.com: WooCommerce REST (primary) → Google Sheets (backup)
  let cfmfhe: Order[] = []
  let cfmfheConfigured = false

  const woo = await getWooOrders() // never throws
  if (woo.configured && !woo.error) {
    cfmfhe = woo.orders
    cfmfheConfigured = true
  } else {
    if (woo.configured && woo.error) {
      problems.push(`WooCommerce API failed (${woo.error}) — using Google Sheets backup`)
    }
    try {
      const sheet = await getSheetOrders()
      if (sheet.configured) {
        cfmfhe = sheet.orders
        cfmfheConfigured = true
      }
    } catch (e) {
      console.error('[sheets backup] failed:', e)
      problems.push('Google Sheets backup unavailable')
    }
  }

  // ── Essential Conversations: Shopify
  const ec = await getEcOrders() // never throws
  if (ec.configured && ec.error) problems.push(`Shopify: ${ec.error}`)

  if (!cfmfheConfigured && !ec.configured) {
    return {
      status: 'mock',
      updatedAt: null,
      data: getMockOrders(),
      note: 'Showing sample data — no order source connected yet.',
    }
  }

  const orders = [...cfmfhe, ...ec.orders]
  return {
    status: problems.length && orders.length === 0 ? 'disconnected' : 'connected',
    updatedAt: new Date().toISOString(),
    data: orders,
    note: problems.length ? problems.join(' · ') : undefined,
  }
}
