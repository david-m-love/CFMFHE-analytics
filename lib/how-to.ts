// In-app setup guides, shown at /how-to/[slug]. Each connection can link to
// one via its `docsSlug`, so any teammate can follow the steps themselves.

export interface GuideStep {
  title: string
  detail: string
}

export interface Guide {
  slug: string
  title: string
  intro: string
  estimate?: string
  steps: GuideStep[]
}

export const GUIDES: Record<string, Guide> = {
  'shopify-direct-api': {
    slug: 'shopify-direct-api',
    title: 'Connect Shopify (direct API)',
    intro:
      'This connects the Essential Conversations Shopify store directly via the Admin API so orders flow in live — no spreadsheet needed. You create a "custom app" in Shopify, copy its access token, and paste it into the Connections page.',
    estimate: '~10 minutes',
    steps: [
      {
        title: 'Open app development in Shopify',
        detail:
          'In your Shopify admin, go to Settings (bottom-left) → "Apps and sales channels" → click "Develop apps" (top-right). If prompted, click "Allow custom app development" and confirm.',
      },
      {
        title: 'Create a custom app',
        detail:
          'Click "Create an app", name it "CFMFHE Analytics", pick yourself as the app developer, and click "Create app".',
      },
      {
        title: 'Grant read access',
        detail:
          'Open the "Configuration" tab → under "Admin API integration" click "Configure" → enable these scopes: read_orders, read_products (read_customers is optional). Click Save.',
      },
      {
        title: 'Install the app',
        detail: 'Go to the "API credentials" tab → click "Install app" → confirm Install.',
      },
      {
        title: 'Copy the Admin API access token',
        detail:
          'Still on "API credentials", under "Admin API access token" click "Reveal token once" and copy it. It starts with "shpat_". ⚠️ Shopify shows it only once — copy it now.',
      },
      {
        title: 'Find your store domain',
        detail:
          'Your store domain looks like "your-store.myshopify.com". It\'s the myshopify address (Settings → Domains, or the part before /admin in your admin URL).',
      },
      {
        title: 'Connect it here',
        detail:
          'In this dashboard: Connections → Shopify → Connect. Paste the store domain and the access token, then "Test & Save". It should turn green and start importing recent orders.',
      },
    ],
  },
  'google-analytics-4': {
    slug: 'google-analytics-4',
    title: 'Connect Google Analytics 4',
    intro:
      'GA4 connects via a Google Cloud "service account" — a robot account you grant read access to your GA4 property.',
    estimate: '~15 minutes',
    steps: [
      { title: 'Create a Google Cloud project', detail: 'At console.cloud.google.com, use the project dropdown → New Project → name it "CFMFHE Analytics" → Create, then select it.' },
      { title: 'Enable the API', detail: 'Search the top bar for "Google Analytics Data API", open it, and click Enable.' },
      { title: 'Create a service account', detail: 'APIs & Services → Credentials → Create Credentials → Service account. Name it "cfmfhe-ga4", Create and Continue, then Done.' },
      { title: 'Create a JSON key', detail: 'Click the service account → Keys tab → Add Key → Create new key → JSON → Create. A file downloads; you\'ll use its client_email and private_key.' },
      { title: 'Find your GA4 Property ID', detail: 'At analytics.google.com → Admin → Property details. The Property ID is a number like 312345678.' },
      { title: 'Grant the service account access', detail: 'Admin → Property Access Management → + → Add users → paste the service-account email, uncheck "Notify by email", role Viewer → Add.' },
      { title: 'Connect it here', detail: 'Connections → Google Analytics 4 → Connect. Paste the service-account email, the private key, and the Property ID, then Test & Save.' },
    ],
  },
  'google-sheets': {
    slug: 'google-sheets',
    title: 'Connect Google Sheets (order data)',
    intro:
      'Order data from WooCommerce can be read from a Google Sheet using a service account, the same kind used for GA4.',
    estimate: '~15 minutes',
    steps: [
      { title: 'Create a service account + JSON key', detail: 'In Google Cloud (console.cloud.google.com): enable the "Google Sheets API", then Credentials → Create Credentials → Service account → create a JSON key (Keys → Add Key → JSON).' },
      { title: 'Share the sheet with it', detail: 'Open your order Google Sheet → Share → paste the service-account email (…iam.gserviceaccount.com) → give Viewer access.' },
      { title: 'Get the sheet ID', detail: 'It\'s the long string in the sheet URL between /d/ and /edit.' },
      { title: 'Connect it here', detail: 'Connections → Google Sheets → Connect. Paste the service-account email, private key, and sheet ID(s), then Test & Save.' },
    ],
  },
}

export function getGuide(slug: string): Guide | null {
  return GUIDES[slug] ?? null
}
