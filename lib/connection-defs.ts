// Field definitions for each data source — used by the Connections UI,
// credential resolution, and health checks. The `env` map gives the
// environment-variable fallback for each field (so existing env-based
// config keeps working alongside in-app stored credentials).

export type ConnId =
  | 'sheets'
  | 'shopify'
  | 'klaviyo'
  | 'ga4'
  | 'anthropic'
  | 'quickbooks'
  | 'meta'
  | 'google_ads'

export const CONNECTION_ORDER: ConnId[] = [
  'sheets',
  'shopify',
  'klaviyo',
  'ga4',
  'meta',
  'google_ads',
  'anthropic',
  'quickbooks',
]

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
  /** apiKey = enter & save; oauth = save app keys, then authorize via redirect */
  kind?: 'apiKey' | 'oauth'
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
  quickbooks: {
    id: 'quickbooks',
    label: 'QuickBooks Online',
    description: 'Cash balance and money in / money out (CEO dashboard)',
    kind: 'oauth',
    setup:
      'Create an app at developer.intuit.com, copy its Client ID & Secret, add this site’s callback URL as a Redirect URI, then save below and click "Connect with QuickBooks".',
    docsSlug: 'quickbooks-oauth',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'from your Intuit app' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'from your Intuit app' },
    ],
    env: {
      clientId: 'QB_CLIENT_ID',
      clientSecret: 'QB_CLIENT_SECRET',
    },
  },
  meta: {
    id: 'meta',
    label: 'Meta Ads',
    description: 'Facebook & Instagram ad spend by campaign (CMO dashboard)',
    kind: 'oauth',
    setup:
      'Create an app at developers.facebook.com, add the Marketing API, copy its App ID & Secret, add this site’s callback as a Valid OAuth Redirect URI, paste your Ad Account ID, save, then click "Connect with Meta Ads".',
    docsSlug: 'meta-ads',
    fields: [
      { key: 'appId', label: 'App ID', type: 'text', placeholder: 'from your Meta app' },
      { key: 'appSecret', label: 'App Secret', type: 'password', placeholder: 'from your Meta app' },
      { key: 'adAccountId', label: 'Ad Account ID', type: 'text', placeholder: 'act_123456789 (or just the number)' },
    ],
    env: {
      appId: 'META_APP_ID',
      appSecret: 'META_APP_SECRET',
      adAccountId: 'META_AD_ACCOUNT_ID',
    },
  },
  google_ads: {
    id: 'google_ads',
    label: 'Google Ads',
    description: 'Search, Shopping & PMax ad spend by campaign (CMO dashboard)',
    kind: 'oauth',
    setup:
      'Create OAuth credentials in Google Cloud, apply for a Google Ads developer token, copy the Client ID/Secret, developer token, and your Ad Account (customer) ID, save, then click "Connect with Google Ads".',
    docsSlug: 'google-ads',
    fields: [
      { key: 'clientId', label: 'OAuth Client ID', type: 'text', placeholder: '…apps.googleusercontent.com' },
      { key: 'clientSecret', label: 'OAuth Client Secret', type: 'password', placeholder: 'from Google Cloud' },
      { key: 'developerToken', label: 'Developer token', type: 'password', placeholder: 'from your Google Ads API Center' },
      { key: 'customerId', label: 'Ad Account (customer) ID', type: 'text', placeholder: '123-456-7890' },
      { key: 'loginCustomerId', label: 'Manager (MCC) ID — optional', type: 'text', placeholder: 'only if accessed via a manager account' },
    ],
    env: {
      clientId: 'GOOGLE_ADS_CLIENT_ID',
      clientSecret: 'GOOGLE_ADS_CLIENT_SECRET',
      developerToken: 'GOOGLE_ADS_DEVELOPER_TOKEN',
      customerId: 'GOOGLE_ADS_CUSTOMER_ID',
      loginCustomerId: 'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
    },
  },
}
