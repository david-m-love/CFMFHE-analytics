import type {
  CustomerType,
  Order,
  ProductType,
  StoreSource,
} from '@/types'
import { MEMBERSHIP_PRODUCT_TYPES } from '@/types'
import { DATES } from './config'

/**
 * Classify a product (by name + price) into a ProductType.
 * Kept here (not in components) so the rules live in one place.
 */
export function classifyProduct(
  productName: string,
  netSales: number,
  source: StoreSource,
): ProductType {
  const name = productName.toLowerCase()

  if (name.includes('flipbook') || name.includes('essential conversations')) {
    return 'ec_flipbook'
  }
  // Shopify workbook-only subscription
  if (source === 'ec' && name.includes('workbook')) {
    return 'workbook_only'
  }
  if (name.includes('workbook')) {
    return 'workbook_monthly'
  }
  if (name.includes('annual') || name.includes('yearly') || name.includes('year')) {
    return 'digital_yearly'
  }
  if (name.includes('semi') || name.includes('6 month') || name.includes('six month')) {
    return 'digital_semiannual'
  }
  if (name.includes('quarter') || name.includes('3 month')) {
    return 'digital_quarterly'
  }
  if (
    name.includes('membership') ||
    name.includes('digital') ||
    name.includes('monthly')
  ) {
    return 'digital_monthly'
  }
  if (
    name.includes('easter') ||
    name.includes('christmas') ||
    name.includes('conference') ||
    name.includes('advent') ||
    name.includes('countdown') ||
    name.includes('seasonal')
  ) {
    return 'seasonal'
  }
  return 'other'
}

export function isMembershipType(type: ProductType): boolean {
  return MEMBERSHIP_PRODUCT_TYPES.includes(type)
}

/**
 * A free trial start = a $0.00 completed order from a `new` customer on a
 * digital membership product, on/after the trial launch date (~Dec 2024).
 */
export function detectFreeTrial(params: {
  netSales: number
  customerType: CustomerType
  productType: ProductType
  date: string
  status: string
}): boolean {
  const { netSales, customerType, productType, date, status } = params
  const completed = /complete|paid|active|processing/i.test(status)
  const isDigital = productType.startsWith('digital_')
  return (
    netSales === 0 &&
    customerType === 'new' &&
    isDigital &&
    completed &&
    date >= DATES.freeTrialLaunch
  )
}

export function normalizeCustomerType(raw: string | undefined): CustomerType {
  if (!raw) return 'unknown'
  const v = raw.toLowerCase()
  if (v.includes('new')) return 'new'
  if (v.includes('return')) return 'returning'
  return 'unknown'
}

/** Build a normalized Order from already-parsed primitive fields. */
export function buildOrder(input: {
  id: string
  source: StoreSource
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
}): Order {
  const primaryProduct = input.productNames[0] ?? ''
  const productType = classifyProduct(
    primaryProduct,
    input.netSales,
    input.source,
  )
  return {
    ...input,
    productType,
    isMembership: isMembershipType(productType),
    isFreeTrial: detectFreeTrial({
      netSales: input.netSales,
      customerType: input.customerType,
      productType,
      date: input.date,
      status: input.status,
    }),
  }
}

export function filterOrders(
  orders: Order[],
  opts: { from?: string; to?: string; source?: StoreSource | 'all' },
): Order[] {
  return orders.filter((o) => {
    if (opts.from && o.date < opts.from) return false
    if (opts.to && o.date > opts.to) return false
    if (opts.source && opts.source !== 'all' && o.source !== opts.source) {
      return false
    }
    return true
  })
}
