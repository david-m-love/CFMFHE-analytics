import type { CustomerType, Order, ProductType, StoreSource } from '@/types'
import { buildOrder } from './orders'

// Deterministic mock dataset so dashboards render before live data is wired.
// Seeded RNG keeps charts stable across renders/builds.
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = ['Sarah', 'Emily', 'Lydia', 'Heather', 'Rachel', 'Megan', 'Anna', 'Jen', 'Kayla', 'Lena', 'Whitney', 'Sydney']
const LAST = ['Johnson', 'Smith', 'Clark', 'Davis', 'Miller', 'Young', 'Allen', 'Hill', 'Adams', 'Baker', 'Nelson', 'Carter']

const DIGITAL_PRODUCTS: { name: string; type: ProductType; price: number }[] = [
  { name: 'Digital Membership - Monthly', type: 'digital_monthly', price: 12 },
  { name: 'Digital Membership - Yearly', type: 'digital_yearly', price: 110 },
  { name: 'Digital Membership - Semiannual', type: 'digital_semiannual', price: 55 },
  { name: 'Digital Membership - Quarterly', type: 'digital_quarterly', price: 30 },
  { name: 'Digital + Workbook Membership - Monthly', type: 'workbook_monthly', price: 25 },
]
const SEASONAL = [
  'Easter: 12 Days of Easter',
  'General Conference Activity Pack',
  'Christmas Service Countdown',
  'Doctrinal Mastery Stickers',
]

function monthsBack(n: number): Date {
  const d = new Date('2026-06-01T00:00:00Z')
  d.setUTCMonth(d.getUTCMonth() - n)
  return d
}

let cached: Order[] | null = null

export function getMockOrders(): Order[] {
  if (cached) return cached
  const rng = mulberry32(20260618)
  const orders: Order[] = []
  let counter = 1

  // 18 months of history across both stores
  for (let m = 17; m >= 0; m--) {
    const monthStart = monthsBack(m)
    const year = monthStart.getUTCFullYear()
    const month = monthStart.getUTCMonth()
    const isJanuary = month === 0
    // January spikes (New Year campaign); EC store only after Nov 2025.
    const ecLive = year > 2025 || (year === 2025 && month >= 10)
    const baseVolume = isJanuary ? 130 : 45 + Math.floor(rng() * 45)

    for (let i = 0; i < baseVolume; i++) {
      const day = 1 + Math.floor(rng() * 27)
      const date = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10)
      const source: StoreSource = ecLive && rng() < 0.28 ? 'ec' : 'cfmfhe'
      const customerType: CustomerType = rng() < 0.65 ? 'new' : 'returning'

      let name: string
      let type: ProductType
      let price: number
      const roll = rng()

      if (source === 'ec') {
        if (roll < 0.6) {
          name = 'Workbook Only Subscription'
          type = 'workbook_only'
          price = 14.95
        } else {
          name = 'Essential Conversations Flipbook'
          type = 'ec_flipbook'
          price = 24.99
        }
      } else if (roll < 0.5) {
        const p = DIGITAL_PRODUCTS[0] // monthly is most common
        name = p.name
        type = p.type
        price = rng() < 0.35 ? 10 : 12 // grandfathered vs current
      } else if (roll < 0.78) {
        const p = DIGITAL_PRODUCTS[1 + Math.floor(rng() * 4)]
        name = p.name
        type = p.type
        price = p.price
      } else {
        name = SEASONAL[Math.floor(rng() * SEASONAL.length)]
        type = 'seasonal'
        price = 8 + Math.floor(rng() * 70)
      }

      // ~30% of new digital signups since trial launch start as $0 trials
      const isTrialEligible =
        customerType === 'new' && type.startsWith('digital_') && date >= '2024-12-01'
      const netSales = isTrialEligible && rng() < 0.45 ? 0 : price

      const firstName = FIRST[Math.floor(rng() * FIRST.length)]
      const lastName = LAST[Math.floor(rng() * LAST.length)]
      const email =
        source === 'ec'
          ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`
          : null // WooCommerce has no email

      orders.push(
        buildOrder({
          id: `${source}-${counter++}`,
          source,
          date,
          customerName: `${firstName} ${lastName}`,
          customerType,
          email,
          productNames: [name],
          itemsSold: 1,
          netSales: Math.round(netSales * 100) / 100,
          status: 'Completed',
          coupon: rng() < 0.15 ? 'WELCOME10' : null,
          attribution: rng() < 0.41 ? 'Unknown' : 'Organic',
        }),
      )
    }
  }

  cached = orders
  return orders
}
