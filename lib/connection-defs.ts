// Field definitions for each data source — used by the Connections UI,
// credential resolution, and health checks. The `env` map gives the
// environment-variable fallback for each field (so existing env-based
// config keeps working alongside in-app stored credentials).

export type ConnId = 'sheets' | 'shopify' | 'klaviyo' | 'ga4' | 'anthropic'

export const CONNECTION_ORDER: ConnId[] = ['sheets', 'shopify', 'klaviyo', 'ga4', 'anthropic']

export interface ConnField {
  key: string
  label: string
  type: 'text' | 'password' | 'textarea'
  placeholder?: string
  help?: string
}

export interface ConnDef {
  id: ConnId
  label: string
  description: string
  /** one-time setup hint shown in the editor */
  setup?: string
  /** slug of an in-app how-to guide (/how-to/[slug]) */
  docsSlug?: string
  fields: ConnField[]
  /** field key -> environment variable fallback */
  env: Record<string, string>
}

export const CONNECTION_DEFS: Record<ConnId, ConnDef> = {
  sheets: {
    id: 'sheets',
    label: 'Google Sheets',
    description: 'Order history from WooCommerce + Shopify',
    setup:
      'In Google Cloud, create a service account, enable the Sheets API, and share each sheet with the service-account email (Viewer).',
    docsSlug: 'google-sheets',
    fields: [
      { key: 'clientEmail', label: 'Service account email', type: 'text', placeholder: 'name@project.iam.gserviceaccount.com' },
      { key: 'privateKey', label: 'Service account private key', type: 'textarea', placeholder: '-----BEGIN PRIVATE KEY-----\n…' },
      { key: 'woocommerceSheetId', label: 'WooCommerce sheet ID', type: 'text', placeholder: 'from the sheet URL' },
      { key: 'shopifySheetId', label: 'Shopify sheet ID', type: 'text', placeholder: 'from the sheet URL' },
    ],
    env: {
      clientEmail: 'GOOGLE_SHEETS_CLIENT_EMAIL',
      privateKey: 'GOOGLE_SHEETS_PRIVATE_KEY',
      woocommerceSheetId: 'GOOGLE_SHEETS_WOOCOMMERCE_SHEET_ID',
      shopifySheetId: 'GOOGLE_SHEETS_SHOPIFY_SHEET_ID',
    },
  },
  shopify: {
    id: 'shopify',
    label: 'Shopify',
    description: 'Live orders from the Essential Conversations store',
    setup: 'Create a custom app in Shopify, enable read_orders + read_products, install it, and copy the Admin API access token.',
    docsSlug: 'shopify-direct-api',
    fields: [
      { key: 'storeDomain', label: 'Store domain', type: 'text', placeholder: 'your-store.myshopify.com' },
      { key: 'accessToken', label: 'Admin API access token', type: 'password', placeholder: 'shpat_…' },
    ],
    env: {
      storeDomain: 'SHOPIFY_STORE_DOMAIN',
      accessToken: 'SHOPIFY_ACCESS_TOKEN',
    },
  },
  klaviyo: {
    id: 'klaviyo',
    label: 'Klaviyo',
    description: 'Email & SMS subscribers and flows',
    setup: 'Create a private API key in Klaviyo (account Vs3idx / klaviyo_blamer-balter).',
    fields: [{ key: 'apiKey', label: 'Private API key', type: 'password', placeholder: 'pk_…' }],
    env: { apiKey: 'KLAVIYO_API_KEY' },
  },
  ga4: {
    id: 'ga4',
    label: 'Google Analytics 4',
    description: 'Website sessions & traffic sources',
    setup:
      'Create a service account, enable the GA Data API, and grant the service account Viewer on the GA4 property.',
    docsSlug: 'google-analytics-4',
    fields: [
      { key: 'clientEmail', label: 'Service account email', type: 'text', placeholder: 'name@project.iam.gserviceaccount.com' },
      { key: 'privateKey', label: 'Service account private key', type: 'textarea', placeholder: '-----BEGIN PRIVATE KEY-----\n…' },
      { key: 'propertyId', label: 'GA4 property ID', type: 'text', placeholder: 'e.g. 312345678' },
    ],
    env: {
      clientEmail: 'GA4_CLIENT_EMAIL',
      privateKey: 'GA4_PRIVATE_KEY',
      propertyId: 'GA4_PROPERTY_ID',
    },
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    description: 'Powers the Ask Anything assistant',
    setup: 'Create an API key in the Anthropic console.',
    fields: [{ key: 'apiKey', label: 'API key', type: 'password', placeholder: 'sk-ant-…' }],
    env: { apiKey: 'ANTHROPIC_API_KEY' },
  },
}
