import type {
  CustomerType,
  Order,
  ProductType,
  StoreSource,
} from '@/types'
import { MEMBERSHIP_PRODUCT_TYPES } from '@/types'
import { DATES } from './config'

/**
 * Classify a product into a ProductType.
 *
 * The product NAME alone is unreliable (the same plan has been called both
 * "Digital Membership - Monthly" and "Digital Subscription - Monthly"). So we
 * also use a `hint` built from the WooCommerce Product Type, SKU, categories,
 * and variation (e.g. "Variable subscription … digital-001 … Subscriptions …
 * Options: Monthly"). This lets every membership variant — regardless of its
 * display name — consolidate into the correct period bucket.
 *
 * Rules live here (not in components) so they're tunable in one place.
 */
export function classifyProduct(
  productName: string,
  netSales: number,
  source: StoreSource,
  hint = '',
): ProductType {
  const text = `${productName} ${hint}`.toLowerCase()

  // EC flipbook (Shopify "Essential Conversations" flipbook)
  if (text.includes('flipbook') || text.includes('essential conversations')) {
    return 'ec_flipbook'
  }

  // Recurring membership / subscription signals: WC type "Variable
  // subscription", a "Subscriptions" category, a digital-/workbook- SKU, or the
  // words membership/subscription in the name.
  const isSubscription =
    /subscription/.test(text) ||
    /membership/.test(text) ||
    /\b(?:digital|workbook)-\d+\b/.test(text)

  const isWorkbook = /workbook/.test(text)

  // Period: prefer the variation/SKU/name signal. Order matters — semiannual is
  // checked before yearly because "semiannual" contains "annual"; the generic
  // "month" check comes last so "6 month"/"3 month" resolve correctly first.
  const period: 'yearly' | 'semiannual' | 'quarterly' | 'monthly' | null =
    /semi|bian|6[\s-]*month|six[\s-]*month/.test(text)
      ? 'semiannual'
      : /quarter|3[\s-]*month|three[\s-]*month/.test(text)
        ? 'quarterly'
        : /year|annual/.test(text)
          ? 'yearly'
          : /month/.test(text)
            ? 'monthly'
            : null

  if (isSubscription) {
    // Shopify workbook-only store subscription
    if (source === 'ec' && isWorkbook) return 'workbook_only'
    // Workbook + digital recurring membership (treated as monthly recurring)
    if (isWorkbook) return 'workbook_monthly'
    switch (period) {
      case 'yearly':
        return 'digital_yearly'
      case 'semiannual':
        return 'digital_semiannual'
      case 'quarterly':
        return 'digital_quarterly'
      default:
        return 'digital_monthly' // monthly, or a membership with no explicit period
    }
  }

  // Non-subscription Shopify workbook (one-time)
  if (source === 'ec' && isWorkbook) return 'workbook_only'

  // One-time seasonal products
  if (/easter|christmas|conference|advent|countdown|seasonal/.test(text)) {
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
  /** extra text (WC product type, SKU, categories, variation) for classification */
  classifyHint?: string
}): Order {
  const primaryProduct = input.productNames[0] ?? ''
  const productType = classifyProduct(
    primaryProduct,
    input.netSales,
    input.source,
    input.classifyHint ?? '',
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
