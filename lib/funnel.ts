import type { Order } from '@/types'
import { FUNNEL } from './config'
import {
  estimatedActiveMembers,
  freeTrialStarts,
  membershipRevenue,
  newMemberRevenue,
  newMembers,
  returningMemberRevenue,
} from './metrics'

export type StageKey =
  | 'reach'
  | 'consider'
  | 'engage'
  | 'trials'
  | 'firstPaid'
  | 'grow'
  | 'commit'
  | 'loyal'

export interface StageKpi {
  label: string
  value: string | number
  sub: string
  /** dynamic compare value, when this KPI supports a delta */
  compareValue?: number | null
}

export interface StageDef {
  num: string
  key: StageKey
  name: string
  metric: string
  color: string
  status: 'live' | 'placeholder'
  isRevStage: boolean
  desc: string
  kpis: (value: number, compareValue: number | null, days: number) => StageKpi[]
  insights: string[]
}

/**
 * Real top-of-funnel inputs from connected sources. When present, they replace
 * the trial-multiplier placeholders for Reach / Consider / Engage.
 */
export interface FunnelExternals {
  reach?: number // GA4 sessions (website visitors)
  consider?: number // GA4 /join-us sessions (membership page views)
  engage?: number // Klaviyo new subscribers (email + SMS)
}

/** True when a stage is backed by real data (not an illustrative placeholder). */
export function stageIsLive(key: StageKey, sources: { ga4: boolean; klaviyo: boolean }): boolean {
  if (key === 'reach' || key === 'consider') return sources.ga4
  if (key === 'engage') return sources.klaviyo
  return true // stages 4–8 are order-based and always live
}

/** Live numeric value for a stage given the orders in a window. */
export function stageValue(key: StageKey, orders: Order[], ext?: FunnelExternals): number {
  const trials = freeTrialStarts(orders)
  const firstPaid = newMembers(orders)
  switch (key) {
    case 'reach':
      return ext?.reach != null ? ext.reach : Math.round(trials * FUNNEL.placeholderMultipliers.reach)
    case 'consider':
      return ext?.consider != null ? ext.consider : Math.round(trials * FUNNEL.placeholderMultipliers.consider)
    case 'engage':
      return ext?.engage != null ? ext.engage : Math.round(trials * FUNNEL.placeholderMultipliers.engage)
    case 'trials':
      return trials
    case 'firstPaid':
      return firstPaid
    case 'grow':
      return Math.round(firstPaid * FUNNEL.retention.month3)
    case 'commit':
      return Math.round(firstPaid * FUNNEL.retention.month6)
    case 'loyal':
      return Math.round(firstPaid * FUNNEL.retention.month12)
  }
}

export interface RevenueStripItem {
  label: string
  value: number
  compareValue: number | null
  format: 'currency' | 'number'
  color: string
  sub: string
}

export function buildRevenueStrip(
  orders: Order[],
  compare: Order[] | null,
  days: number,
): RevenueStripItem[] {
  const c = compare
  return [
    {
      label: 'Total Membership Revenue',
      value: membershipRevenue(orders),
      compareValue: c ? membershipRevenue(c) : null,
      format: 'currency',
      color: '#3B6FA0',
      sub: `All membership orders · last ${days} days`,
    },
    {
      label: 'New Member Revenue',
      value: newMemberRevenue(orders),
      compareValue: c ? newMemberRevenue(c) : null,
      format: 'currency',
      color: '#2A7A58',
      sub: 'First paid orders only',
    },
    {
      label: 'Returning Member Revenue',
      value: returningMemberRevenue(orders),
      compareValue: c ? returningMemberRevenue(c) : null,
      format: 'currency',
      color: '#6B5EA8',
      sub: 'Recurring renewals',
    },
    {
      label: 'New Members',
      value: newMembers(orders),
      compareValue: c ? newMembers(c) : null,
      format: 'number',
      color: '#C4A030',
      sub: 'First paid orders',
    },
    {
      label: 'Est. Active Members',
      value: estimatedActiveMembers(orders),
      compareValue: null,
      format: 'number',
      color: '#C45848',
      sub: 'Monthly + Annual + Workbook',
    },
  ]
}

export const STAGE_DEFS: StageDef[] = [
  {
    num: '01',
    key: 'reach',
    name: 'Reach',
    metric: 'Website visitors',
    color: '#4E86B8',
    status: 'placeholder',
    isRevStage: false,
    desc: 'Total unique visitors to comefollowmefhe.com. The widest part of the funnel.',
    kpis: (v, c, days) => [
      { label: 'Sessions', value: v.toLocaleString(), sub: `Last ${days} days`, compareValue: c },
      { label: 'Join Page Views', value: Math.round(v * 0.1).toLocaleString(), sub: '~10% find /join-us · Est.' },
      { label: 'Avg Session', value: '2m 14s', sub: 'Time on site · Est.' },
      { label: 'Bounce Rate', value: '64%', sub: 'Left after 1 page · Est.' },
    ],
    insights: [
      '<strong>From GA4</strong> when connected — total website sessions in the period (else illustrative).',
      'The biggest drop in the entire funnel happens here — only ~10% of visitors ever find the membership page.',
    ],
  },
  {
    num: '02',
    key: 'consider',
    name: 'Consider',
    metric: 'Membership page views',
    color: '#5A9E8A',
    status: 'placeholder',
    isRevStage: false,
    desc: 'Visitors who reached /join-us — the membership landing page. A high-intent action; many site buttons point here.',
    kpis: (v, c, days) => [
      { label: '/join-us Sessions', value: v.toLocaleString(), sub: `Last ${days} days`, compareValue: c },
      { label: '% of All Traffic', value: '10%', sub: 'Who find the page · Est.' },
      { label: 'CTA Click Rate', value: '18%', sub: 'Clicked Start Free Trial · Est.' },
      { label: 'Avg Time on Page', value: '1m 48s', sub: 'Engaged reading · Est.' },
    ],
    insights: [
      '<strong>From GA4</strong> when connected — sessions landing on /join-us (else illustrative).',
      'Visitors who scroll past the pricing section convert at higher rates — scroll-depth tracking recommended.',
    ],
  },
  {
    num: '03',
    key: 'engage',
    name: 'Engage',
    metric: 'Freebie / email signups',
    color: '#6BAE6A',
    status: 'placeholder',
    isRevStage: false,
    desc: 'Visitors who opted into a freebie or the email list — the first signal of real intent.',
    kpis: (v, c, days) => [
      { label: 'New Subscribers', value: v.toLocaleString(), sub: `Email + SMS · last ${days} days`, compareValue: c },
      { label: 'Conv. from Visitors', value: '2.8%', sub: 'Visitor → email · Est.' },
      { label: 'Top Source', value: 'Popup', sub: 'Free lesson offer' },
      { label: 'Avg Days to Trial', value: '~12', sub: 'Email → trial start · Est.' },
    ],
    insights: [
      '<strong>From Klaviyo</strong> when connected — new email + SMS subscribers in the period (else illustrative).',
      'Watch the popup signup lists specifically — they were once found empty; the Email &amp; SMS tab now shows real per-list counts.',
    ],
  },
  {
    num: '04',
    key: 'trials',
    name: 'Try',
    metric: 'Free trial starts',
    color: '#C4A030',
    status: 'live',
    isRevStage: false,
    desc: '$0 new-customer orders — the 14-day free trial. The top of the trackable funnel.',
    kpis: (v, c, days) => [
      { label: 'Trial Starts', value: v, sub: `Last ${days} days`, compareValue: c },
      { label: 'Monthly Avg (2025–26)', value: 56, sub: 'Since trial launched Dec 2024' },
      { label: 'Peak Month', value: 113, sub: 'January 2026' },
      { label: 'Pre-Dec 2024 Total', value: 47, sub: 'All of 2023 + 2024 combined' },
    ],
    insights: [
      '<strong>Real data.</strong> Tracked via $0 completed new-customer orders.',
      "The free trial launched December 2024 — it effectively didn't exist before that.",
      '<strong>Watch trial→paid conversion: a sharp drop signals something broken upstream.</strong>',
    ],
  },
  {
    num: '05',
    key: 'firstPaid',
    name: 'Convert',
    metric: 'First payment',
    color: '#D07830',
    status: 'live',
    isRevStage: true,
    desc: 'First paid order per customer — the moment someone becomes a real member.',
    kpis: (v, c, days) => [
      { label: 'First Payments', value: v, sub: `Last ${days} days`, compareValue: c },
      { label: '14-Day Conv. Rate', value: '50–74%', sub: 'Range 2025–2026' },
      { label: 'Avg First Payment', value: '$12', sub: 'Monthly · most common' },
      { label: 'Annual Direct', value: '26%', sub: 'Skip monthly, go straight to annual' },
    ],
    insights: [
      '<strong>Real data.</strong> First paid order following a $0 trial order.',
      'Jan–Feb is historically the strongest conversion window.',
      'Revenue at this stage = new-member revenue only.',
    ],
  },
  {
    num: '06',
    key: 'grow',
    name: 'Grow',
    metric: 'Active at month 3',
    color: '#C45848',
    status: 'live',
    isRevStage: true,
    desc: 'Members still paying at month 3 — the first major checkpoint, where much early churn happens.',
    kpis: (v, c, days) => [
      { label: 'Est. Mo-3 Active', value: v, sub: `Approx. from ${days}-day cohort`, compareValue: c },
      { label: 'Mo-3 Retention', value: '~60%', sub: 'Of monthly converts · Est.' },
      { label: 'Mo-1 Churn', value: '19%', sub: 'Largest single dropout point' },
      { label: 'Best Cohort Mo-3', value: '75%', sub: 'Jan 2023 launch cohort' },
    ],
    insights: [
      '<strong>Estimated</strong> from monthly order sequences; the Cohorts tab will compute this directly.',
      '<strong>Highest-ROI intervention:</strong> a strong month 1–2 onboarding email sequence.',
    ],
  },
  {
    num: '07',
    key: 'commit',
    name: 'Commit',
    metric: 'Active at month 6',
    color: '#A04878',
    status: 'live',
    isRevStage: true,
    desc: 'Members still paying at month 6 — a stability threshold; cohorts above ~45% here usually become long-term.',
    kpis: (v, c, days) => [
      { label: 'Est. Mo-6 Active', value: v, sub: `Approx. from ${days}-day cohort`, compareValue: c },
      { label: 'Mo-6 Retention', value: '~40%', sub: 'Of monthly converts · Est.' },
      { label: 'Upgrade Rate', value: '8.2%', sub: 'Switch to annual by mo 6' },
      { label: 'Median Upgrade Timing', value: '4 months', sub: 'Before switching to annual' },
    ],
    insights: [
      '<strong>Estimated.</strong> Month 6 is the clearest LTV divergence point.',
      'Most monthly→annual upgrades cluster in January, August, and May — all campaign windows.',
    ],
  },
  {
    num: '08',
    key: 'loyal',
    name: 'Loyal',
    metric: 'Active at month 12+',
    color: '#6B5EA8',
    status: 'live',
    isRevStage: true,
    desc: 'Members paying for a full year or more. Highest LTV, most likely to refer, lowest churn risk.',
    kpis: (v, c, days) => [
      { label: 'Est. Mo-12 Active', value: v, sub: `Approx. from ${days}-day cohort`, compareValue: c },
      { label: 'Mo-12 Retention', value: '23–42%', sub: 'Range across Jan cohorts' },
      { label: 'LTV at 12 Months', value: '$144+', sub: 'Monthly plan members' },
      { label: '13–18 Mo Spike', value: 'curriculum end', sub: 'Year-end re-enroll dropoff' },
    ],
    insights: [
      '<strong>Estimated</strong> from long-term order history.',
      'The 13–18 month churn spike = families finishing a curriculum year and not re-enrolling. A May–July "re-enroll" campaign could recover many.',
    ],
  },
]
