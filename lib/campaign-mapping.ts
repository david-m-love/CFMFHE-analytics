// Ad-campaign types + the campaign→product mapping logic. This module is PURE
// (no server-only imports) so both the server ad connectors and the client CMO
// dashboard can use it. The mapping turns blended ad spend into per-product ad
// spend, which powers per-product ROAS.

export type AdSource = 'meta' | 'google_ads'

export const AD_SOURCE_LABELS: Record<AdSource, string> = {
  meta: 'Meta Ads',
  google_ads: 'Google Ads',
}

export interface AdCampaign {
  id: string // `${source}:${remoteId}`
  source: AdSource
  name: string
  status: 'active' | 'paused'
  spend: number
}

export interface AdSpendData {
  total: number
  bySource: Record<AdSource, number>
  campaigns: AdCampaign[]
}

/** campaign id → product name (explicit user mapping). */
export type CampaignMap = Record<string, string>

const round = (n: number) => Math.round(n * 100) / 100

// Words that describe the campaign's *job*, not the product — stripped before
// matching a campaign name to a product name.
const STOPWORDS = new Set([
  'prospecting', 'retargeting', 'remarketing', 'broad', 'search', 'brand',
  'branded', 'shopping', 'pmax', 'performance', 'max', 'campaign', 'ad', 'ads',
  'sale', 'bundle', 'seasonal', 'new', 'top', 'core', 'us', 'conversions',
  'conversion', 'traffic', 'awareness', 'lookalike', 'lal', 'interest',
  'evergreen', 'promo', 'launch', 'test', 'cold', 'warm', 'the', 'and', 'for',
  'with', 'only', 'subscription', 'membership', 'plan',
])

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
}

/**
 * Suggest the best-matching product name for a campaign by token overlap.
 * Returns null when nothing meaningfully overlaps.
 */
export function suggestProduct(campaignName: string, productNames: string[]): string | null {
  const camp = new Set(tokenize(campaignName))
  if (!camp.size) return null
  let best: string | null = null
  let bestScore = 0
  for (const name of productNames) {
    const prod = tokenize(name)
    if (!prod.length) continue
    const shared = prod.filter((t) => camp.has(t)).length
    if (!shared) continue
    // normalize by product token count so a short, precise product wins ties
    const score = shared + shared / prod.length
    if (score > bestScore) {
      bestScore = score
      best = name
    }
  }
  return best
}

/**
 * Resolve every campaign to a product: explicit map first, then a name-based
 * suggestion as fallback. Campaigns with no match are left unassigned.
 */
export function resolveCampaignProducts(
  campaigns: AdCampaign[],
  map: CampaignMap,
  productNames: string[],
): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  for (const c of campaigns) {
    out[c.id] = map[c.id] ?? suggestProduct(c.name, productNames)
  }
  return out
}

/** Per-product ad spend = sum of spend of campaigns resolved to that product. */
export function adSpendByProduct(
  campaigns: AdCampaign[],
  map: CampaignMap,
  productNames: string[],
): Record<string, number> {
  const resolved = resolveCampaignProducts(campaigns, map, productNames)
  const out: Record<string, number> = {}
  for (const c of campaigns) {
    const product = resolved[c.id]
    if (!product) continue
    out[product] = round((out[product] ?? 0) + c.spend)
  }
  return out
}

/** Spend that couldn't be attributed to any product (for honesty in the UI). */
export function unattributedSpend(
  campaigns: AdCampaign[],
  map: CampaignMap,
  productNames: string[],
): number {
  const resolved = resolveCampaignProducts(campaigns, map, productNames)
  return round(campaigns.filter((c) => !resolved[c.id]).reduce((s, c) => s + c.spend, 0))
}
