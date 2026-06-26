// Central config — benchmarks, thresholds, and column mappings.
// Per the brief: do NOT hard-code analysis thresholds in components.
// Pull them from here so they can be tuned without touching UI code.

export const BENCHMARKS = {
  // Targets (end of 2027)
  targetActiveMembers: 4000,
  targetMrr: 40000,

  // Health thresholds
  trialConversion: {
    healthyMin: 0.5, // 50–74% when healthy
    brokenAt: 0.18, // 18% when broken
  },
  monthlyChurn: {
    current: 0.14,
    target: 0.05,
  },
  newMembersPerMonth: {
    currentLow: 25,
    currentHigh: 85,
    historicalLow: 96,
    historicalHigh: 138,
  },
} as const

// Pricing reference (USD)
export const PRICING = {
  digitalMonthlyGrandfathered: 10,
  digitalMonthlyCurrent: 12,
  workbookMonthly: 25,
  workbookOnlyMonthly: 14.95,
  workbookOnlyFirstMonth: 4.95,
  yearlyTiers: [97, 110, 120],
  semiannual: 55,
  quarterly: 30,
} as const

// Important historical dates for graceful handling.
export const DATES = {
  // 14-day free trial launched ~Dec 2024; $0 orders before this are NOT trials.
  freeTrialLaunch: '2024-12-01',
  // WooCommerce–Klaviyo integration broke ~Dec 2025; attribution unreliable after.
  attributionBreak: '2025-12-01',
  // Shopify workbook-only store launched ~Nov 2025.
  ecStoreLaunch: '2025-11-01',
} as const

// Membership funnel tuning. Retention is an estimate applied to converts
// (real cohort retention lands in the Cohorts tab). Placeholder multipliers
// scale the illustrative top-of-funnel stages until GA4 + Klaviyo connect.
export const FUNNEL = {
  retention: { month3: 0.6, month6: 0.4, month12: 0.27 },
  placeholderMultipliers: { reach: 470, consider: 47, engage: 13 },
} as const

// January is anomalously high (New Year curriculum campaign). Flag, don't hide.
export const JANUARY_ANOMALY_NOTE =
  'January is seasonally elevated (New Year Come Follow Me campaign) and is not representative of baseline.'

/**
 * Configurable column mapping for the Google Sheets data layer.
 * Sheet tab names + headers are confirmed once Zach completes setup
 * (EOW 2026-06-20). Adjust here without code changes.
 */
export const SHEET_MAPPING = {
  woocommerce: {
    tab: 'Completed Orders',
    columns: {
      date: 'Date',
      orderId: 'Order #',
      status: 'Status',
      customerName: 'Customer Name',
      customerType: 'Customer Type',
      products: 'Product(s)',
      itemsSold: 'Items Sold',
      netSales: 'Net Sales',
      coupon: 'Coupon(s)',
      attribution: 'Attribution',
      email: null, // WooCommerce export has no email
    },
  },
  shopify: {
    tab: 'shopify_orders',
    columns: {
      date: 'Created At',
      orderId: 'Order Name',
      status: 'Financial Status',
      customerName: 'Billing Name',
      customerType: null, // derived
      products: 'Lineitem Name',
      itemsSold: 'Lineitem Quantity',
      netSales: 'Subtotal',
      coupon: 'Discount Code',
      attribution: 'Source',
      email: 'Email',
    },
  },
} as const
