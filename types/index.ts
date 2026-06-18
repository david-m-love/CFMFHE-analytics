// Shared types for CFMFHE Analytics

export type StoreSource = 'cfmfhe' | 'ec'

export const STORE_LABELS: Record<StoreSource, string> = {
  cfmfhe: 'comefollowmefhe.com',
  ec: 'essentialconversationsforfamilies.com',
}

export type ProductType =
  | 'digital_monthly'
  | 'digital_yearly'
  | 'digital_semiannual'
  | 'digital_quarterly'
  | 'workbook_monthly'
  | 'workbook_only'
  | 'seasonal'
  | 'ec_flipbook'
  | 'other'

export const MEMBERSHIP_PRODUCT_TYPES: ProductType[] = [
  'digital_monthly',
  'digital_yearly',
  'digital_semiannual',
  'digital_quarterly',
  'workbook_monthly',
  'workbook_only',
]

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  digital_monthly: 'Digital Membership — Monthly',
  digital_yearly: 'Digital Membership — Yearly',
  digital_semiannual: 'Digital Membership — Semiannual',
  digital_quarterly: 'Digital Membership — Quarterly',
  workbook_monthly: 'Workbook Subscription — Monthly',
  workbook_only: 'Workbook Only Subscription',
  seasonal: 'Seasonal / One-Time Product',
  ec_flipbook: 'EC Flipbook',
  other: 'Other',
}

export type CustomerType = 'new' | 'returning' | 'unknown'

/** Normalized, source-agnostic order record. */
export interface Order {
  id: string
  source: StoreSource
  date: string // ISO date
  customerName: string
  customerType: CustomerType
  email: string | null // WooCommerce orders have no email
  productNames: string[]
  productType: ProductType
  isMembership: boolean
  itemsSold: number
  netSales: number
  status: string
  isFreeTrial: boolean
  coupon: string | null
  attribution: string | null
}

export interface DateRange {
  from: string // ISO date
  to: string // ISO date
}

export type CompareMode = 'previous_period' | 'previous_year' | 'custom' | 'off'

export interface KpiValue {
  value: number
  previous?: number
  /** percent delta vs previous; positive = up */
  deltaPct?: number
  format: 'currency' | 'number' | 'percent'
  /** whether an upward move is good (revenue) or bad (churn) */
  goodWhen?: 'up' | 'down'
}

/** Health of a connected data source for graceful degradation. */
export type SourceStatus = 'connected' | 'disconnected' | 'mock'

export interface DataEnvelope<T> {
  status: SourceStatus
  updatedAt: string | null
  data: T
  note?: string
}
