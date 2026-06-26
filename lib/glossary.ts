// Plain-English definitions surfaced via the ⓘ tooltips next to metrics.

export interface GlossaryEntry {
  term: string
  definition: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  mrr: {
    term: 'MRR (Monthly Recurring Revenue)',
    definition:
      'Predictable subscription revenue normalized to a monthly figure. Annual/quarterly plans are divided down to their per-month value.',
  },
  activeMembers: {
    term: 'Active Members',
    definition:
      'Estimated count of distinct customers with a paid membership in the period. An estimate until cancellation events are wired in.',
  },
  churn: {
    term: 'Monthly Churn',
    definition:
      'The share of members who cancel in a month. Currently modeled (~14%) until cancellation data is connected.',
  },
  trialConversion: {
    term: 'Trial → Paid',
    definition:
      'Of people who start a free trial, the share who become paying members.',
  },
  aov: {
    term: 'AOV (Average Order Value)',
    definition: 'Total revenue divided by number of orders in the period.',
  },
  ltv: {
    term: 'LTV (Lifetime Value)',
    definition:
      'Total revenue a customer generates over their entire relationship with the business.',
  },
  roas: {
    term: 'ROAS (Return on Ad Spend)',
    definition:
      'Revenue generated for every $1 of ad spend. Blended ROAS uses all revenue ÷ all ad spend.',
  },
  ncRoas: {
    term: 'NC-ROAS (New-Customer ROAS)',
    definition:
      'Revenue from first-time customers ÷ ad spend — measures how efficiently ads acquire NEW customers.',
  },
  mer: {
    term: 'MER (Marketing Efficiency Ratio)',
    definition: 'Total revenue ÷ total ad spend across all channels — the blended efficiency of marketing.',
  },
  cac: {
    term: 'CAC (Customer Acquisition Cost)',
    definition: 'Ad spend ÷ number of customers acquired. nCAC limits this to NEW customers.',
  },
  contributionMargin: {
    term: 'Contribution Margin',
    definition:
      'What’s left from revenue after variable costs (COGS, shipping, fees, and ad spend). It’s the money each sale "contributes" toward fixed costs and profit.',
  },
  newVsReturning: {
    term: 'New vs Returning',
    definition:
      'Splits sales between first-time and repeat customers. Across stores, the same person is matched so a repeat buyer isn’t miscounted as new.',
  },
}
