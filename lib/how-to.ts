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
      'Connects the Essential Conversations store via the Admin API so orders flow in live. IMPORTANT (Jan 2026 change): you can no longer create custom apps in the Shopify admin — new apps are made in the Shopify DEV DASHBOARD (dev.shopify.com/dashboard) and give you a Client ID + Client Secret instead of a static token. Paste those here and the dashboard fetches a short-lived token for you automatically. (Have a pre-2026 custom app with a real Admin API access token? Use the legacy token field instead and leave Client ID/Secret blank.)',
    estimate: '~15 minutes (plus possible approval wait for customer data)',
    steps: [
      {
        title: 'Create the app in the Dev Dashboard',
        detail:
          'Go to dev.shopify.com/dashboard → Apps → "Create app" (top right) → "Start from Dev Dashboard" → name it "CFMFHE Analytics" → Create. (This replaces the old "Develop apps" flow in the store admin, which is gone for new apps as of Jan 1, 2026.)',
      },
      {
        title: 'Create a version with your scopes',
        detail:
          'Open the Versions tab. Set the app URL (if you have none, use https://shopify.dev/apps/default-app-home), pick the newest Webhooks API version, and add access scopes: read_orders, read_products, read_all_orders (read_all_orders is required or you only get the last 60 days). Click "Release". An app needs at least one released version before it can be installed.',
      },
      {
        title: 'Request protected customer data (if you need names/emails)',
        detail:
          'To read customer name/email on orders, request "Protected customer data access" for the app. Shopify approval can take a few days. Orders, products, and revenue work without it; cross-store customer matching for this store is limited until it’s granted.',
      },
      {
        title: 'Install on the store',
        detail:
          'From the app’s Home in the Dev Dashboard, scroll down → "Install app" → select the Essential Conversations store → Install.',
      },
      {
        title: 'Copy the Client ID and Client Secret',
        detail:
          'In the app’s Settings / Overview, copy the Client ID and Client Secret. NOTE: there is no copy-paste access token anymore — these credentials are exchanged for a short-lived token automatically by this dashboard (client-credentials grant, refreshed every ~24h).',
      },
      {
        title: 'Find your store domain',
        detail:
          'Use the ".myshopify.com" address (e.g. essential-conversations.myshopify.com), not the public custom domain — the Admin API only answers on the myshopify domain.',
      },
      {
        title: 'Connect it here',
        detail:
          'Connections → Shopify → Connect. Enter the store domain, Client ID, and Client Secret (leave the legacy token field blank), then "Test & Save". It should turn green with your shop name. Errors: "token grant 4xx" = wrong Client ID/Secret or app not installed on this store; "returned 404" = wrong domain; green but few old orders = missing read_all_orders scope.',
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
  'quickbooks-oauth': {
    slug: 'quickbooks-oauth',
    title: 'Connect QuickBooks Online',
    intro:
      'QuickBooks connects via OAuth: you create an app on Intuit’s developer site, paste its Client ID & Secret here, then click "Connect with QuickBooks" to authorize. Powers the CEO dashboard (cash balance, money in/out).',
    estimate: '~10 minutes',
    steps: [
      { title: 'Create an Intuit app', detail: 'Go to developer.intuit.com → sign in → My Apps → Create an app → choose the QuickBooks Online Accounting scope.' },
      { title: 'Pick ONE environment (Dev or Production)', detail: 'Intuit apps have separate "Development" and "Production" keys, and EACH has its own Client ID/Secret AND its own Redirect URIs list. Use the same environment for both steps below — mixing them is the #1 cause of "redirect_uri is invalid". Use Production for real company data.' },
      { title: 'Copy keys', detail: 'On the "Keys & credentials" tab for your chosen environment, copy the Client ID and Client Secret — those are what you paste into the dashboard.' },
      { title: 'Add the redirect URI — EXACTLY', detail: 'On that SAME Keys & credentials tab, under "Redirect URIs", click Add and paste the value the dashboard shows in the Connect dialog (use its Copy button), e.g. https://cfmfhe-analytics.vercel.app/api/oauth/quickbooks/callback — then SAVE. It must match exactly: https (not http), no trailing slash, lowercase. If you saved Development keys, the redirect URI must be on the Development tab (and vice versa).' },
      { title: 'Save the keys here', detail: 'In this dashboard: Connections → QuickBooks Online → Connect. Paste the Client ID & Secret and click "Test & Save".' },
      { title: 'Authorize', detail: 'Click "Connect with QuickBooks", sign in to Intuit, pick the company, and approve. You’ll come back here connected.' },
      { title: 'View it', detail: 'Open the CEO dashboard to see cash balance and money in / money out.' },
    ],
  },
  'meta-ads': {
    slug: 'meta-ads',
    title: 'Connect Meta Ads (Facebook & Instagram)',
    intro:
      'Meta Ads connects via OAuth so Facebook/Instagram campaign spend flows into the CMO dashboard. You create an app on Meta for Developers, paste its App ID & Secret plus your Ad Account ID here, then click "Connect with Meta Ads" to authorize read-only access to ad insights.',
    estimate: '~15 minutes',
    steps: [
      { title: 'Create a Meta app', detail: 'Go to developers.facebook.com → My Apps → Create App → choose "Other" → "Business" type. Name it "CFMFHE Analytics".' },
      { title: 'Add the Marketing API', detail: 'In the app dashboard, find "Marketing API" and click "Set up". This grants access to ad insights (ads_read).' },
      { title: 'Copy the App ID & Secret', detail: 'App settings → Basic. Copy the App ID and click "Show" to copy the App Secret.' },
      { title: 'Add the redirect URI', detail: 'Add Facebook Login → Settings → "Valid OAuth Redirect URIs", add exactly: https://cfmfhe-analytics.vercel.app/api/oauth/meta/callback' },
      { title: 'Find your Ad Account ID', detail: 'In Meta Ads Manager → Account dropdown (top-left). The ID looks like "act_1234567890" (or just the number).' },
      { title: 'Save the keys here', detail: 'Connections → Meta Ads → Connect. Paste the App ID, App Secret, and Ad Account ID, then "Test & Save".' },
      { title: 'Authorize', detail: 'Click "Connect with Meta Ads", log in, and approve the ads_read permission. You\'ll return here connected; spend appears on the CMO dashboard.' },
    ],
  },
  'google-ads': {
    slug: 'google-ads',
    title: 'Connect Google Ads',
    intro:
      'Google Ads connects via OAuth and requires a Google Ads API "developer token". You create OAuth credentials in Google Cloud, request a developer token from your Google Ads account, paste everything here, then authorize. Search/Shopping/PMax spend then flows into the CMO dashboard.',
    estimate: '~25 minutes (developer-token approval can take longer)',
    steps: [
      { title: 'Create OAuth credentials', detail: 'At console.cloud.google.com → APIs & Services → Credentials → Create Credentials → OAuth client ID → type "Web application". Copy the Client ID and Client Secret.' },
      { title: 'Add the redirect URI', detail: 'On that OAuth client, under "Authorized redirect URIs" add exactly: https://cfmfhe-analytics.vercel.app/api/oauth/google_ads/callback' },
      { title: 'Enable the Google Ads API', detail: 'In the same project, search for "Google Ads API" and click Enable.' },
      { title: 'Get a developer token', detail: 'In your Google Ads account → Tools → API Center. Copy the developer token. A "test" token works against test accounts immediately; "basic access" (for live data) requires a short approval.' },
      { title: 'Find your customer ID', detail: 'Top-right of the Google Ads UI — a 10-digit number like 123-456-7890. If you access it through a manager (MCC) account, note that ID too.' },
      { title: 'Save the keys here', detail: 'Connections → Google Ads → Connect. Paste the Client ID/Secret, developer token, customer ID (and manager ID if applicable), then "Test & Save".' },
      { title: 'Authorize', detail: 'Click "Connect with Google Ads", choose your Google account, and approve. You\'ll return here connected.' },
    ],
  },
  'woocommerce-rest-api': {
    slug: 'woocommerce-rest-api',
    title: 'Connect WooCommerce (direct API)',
    intro:
      'Connects comefollowmefhe.com directly via the WooCommerce REST API (wc/v3) — the primary order source, including customer emails for accurate cross-store matching. This replaces the Google Sheets export as the live feed; Sheets automatically stays on as a backup if the API is ever unavailable. You generate a read-only key pair in WordPress and paste it here.',
    estimate: '~10–15 minutes',
    steps: [
      {
        title: 'Confirm WooCommerce 9.0+ and HTTPS',
        detail:
          'The store must run WooCommerce 9.0+ (the modern wc/v3 API ships in core; the old legacy REST API was removed) and be served over HTTPS — comefollowmefhe.com already is. HTTPS is required because Basic Auth sends the key/secret base64-encoded, which is reversible without TLS.',
      },
      {
        title: 'Enable pretty permalinks (the #1 missed step)',
        detail:
          'In WordPress admin: Settings → Permalinks → select ANY option except "Plain" (for example "Day and name" or "Post name") → Save Changes. With Plain permalinks every /wp-json/ API call returns a 404. If the API was already working you can leave this as-is.',
      },
      {
        title: 'Open the REST API key screen',
        detail:
          'In WordPress admin: WooCommerce → Settings → Advanced → REST API. Click "Add key" (older versions say "Create an API key"). If you don\'t see "Advanced", make sure you\'re an admin and WooCommerce is active.',
      },
      {
        title: 'Create a READ-ONLY key',
        detail:
          'Description: "CFMFHE Analytics Dashboard". User: pick an Administrator account (the key inherits that user\'s capabilities). Permissions: Read — the dashboard only reads orders, never writes. Click "Generate API key".',
      },
      {
        title: 'Copy the Consumer key & Consumer secret',
        detail:
          'After generating you\'ll see a Consumer key (starts with ck_) and Consumer secret (starts with cs_), each ~43 characters. ⚠️ The secret is displayed ONLY ONCE — copy both now and store them safely. If you lose the secret you simply revoke the key and create a new one.',
      },
      {
        title: 'Test the key before handing it over (optional but recommended)',
        detail:
          'From a terminal: curl https://comefollowmefhe.com/wp-json/wc/v3/orders -u ck_yourkey:cs_yoursecret -G --data-urlencode "per_page=1" — a 200 with a JSON order array confirms keys + permalinks + server config are all good. (Or in Postman: GET that URL, Auth tab → Basic Auth → key as Username, secret as Password.)',
      },
      {
        title: 'Connect it in the dashboard',
        detail:
          'In this dashboard: Connections → WooCommerce (direct API) → Connect. Store URL: https://comefollowmefhe.com. Consumer key: ck_… Consumer secret: cs_… Then click "Test & Save". Green means it\'s now the PRIMARY order source; the first load pages through all orders and caches them (then refreshes every ~6 hours).',
      },
      {
        title: 'If it fails — error → fix',
        detail:
          '404 on every call = pretty permalinks not enabled (step 2). 401 Unauthorized = wrong key/secret, or the store was reached over HTTP. 403 Forbidden = the key isn\'t Read-enabled — regenerate it. "Consumer key is missing" = the host strips the Authorization header (rare; add the .htaccess Authorization rewrite, or tell us and we\'ll switch the connector to query-param auth). Google Sheets stays the backup the whole time, so analytics never go dark.',
      },
    ],
  },
  'google-sheets': {
    slug: 'google-sheets',
    title: 'Connect Google Sheets (order data)',
    intro:
      'Google Sheets doesn’t use a normal login. You create a "service account" — a robot Google account — download a key file for it, and then SHARE your spreadsheet with that robot’s email. Two steps trip most people up: (1) you must share the sheet with the service-account email, and (2) the tab inside the spreadsheet must be named exactly "Completed Orders" (and "shopify_orders" for the Shopify tab). The green Test can pass even when the tab name is wrong, so double-check it.',
    estimate: '~15 minutes',
    steps: [
      { title: 'Create a Google Cloud project', detail: 'Go to console.cloud.google.com and sign in. Top-left project dropdown → New Project → name it "CFMFHE Analytics" → Create, then make sure it’s selected.' },
      { title: 'Enable the Sheets API', detail: 'Left menu (☰) → APIs & Services → Library. Search "Google Sheets API", open it, and click Enable. (Enable it in THIS project.)' },
      { title: 'Create a service account', detail: '☰ → APIs & Services → Credentials → "+ Create Credentials" → Service account. Name it "cfmfhe-sheets" → Create and Continue. On the "grant access" step, skip it — click Continue, then Done. It needs no project roles; access comes from sharing the sheet.' },
      { title: 'Create its JSON key', detail: 'On the Credentials page, under Service Accounts, click the one you just made → Keys tab → Add Key → Create new key → JSON → Create. A .json file downloads — treat it like a password.' },
      { title: 'Copy two values from the JSON', detail: 'Open the .json in any text editor. Copy (a) "client_email" — looks like cfmfhe-sheets@…iam.gserviceaccount.com — and (b) "private_key" — the whole block from -----BEGIN PRIVATE KEY----- to -----END PRIVATE KEY-----, including the \\n parts. Paste it exactly as-is; the app handles the \\n.' },
      { title: '⭐ Share the spreadsheet with the robot (most-missed step)', detail: 'Open your Google Sheet → green Share button (top-right) → paste the client_email from the previous step → set it to Viewer → uncheck "Notify people" → Share/Done. If Woo and Shopify are in separate spreadsheets, do this on both.' },
      { title: 'Get the Sheet ID', detail: 'It’s the long code in the URL between /d/ and /edit: docs.google.com/spreadsheets/d/THIS_PART/edit.' },
      { title: '⭐ Check the tab name', detail: 'At the bottom of the spreadsheet, the tab with WooCommerce orders must be named exactly "Completed Orders" (and "shopify_orders" for the Shopify tab if it’s in the same file). Right-click the tab → Rename if needed. The app is already mapped to the standard WooCommerce order-export columns (Order Id, Created Date, Product Name, Product Quantity, Product Total, Billing First/Last name, Coupons Codes, UTM Source, Email). If your export uses different header names, send them over and we’ll remap.' },
      { title: 'Connect it here', detail: 'Connections → Google Sheets → Connect. Paste the service-account email, the private key, and the Sheet ID. If Woo + Shopify are two tabs in ONE spreadsheet, put the same Sheet ID in both fields. Click Test & Save — it should turn green.' },
      { title: 'If it fails', detail: '403 / "caller does not have permission" = you didn’t share the sheet (step 6). "API disabled" = step 2 missed or wrong project. Green test but no orders = tab not named "Completed Orders" (step 8). "invalid_grant"/key error = private key wasn’t copied whole. Can’t create a key at all = your Workspace org blocks it; use a personal Google account or ask your admin.' },
    ],
  },
}

export function getGuide(slug: string): Guide | null {
  return GUIDES[slug] ?? null
}
