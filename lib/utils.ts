import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(n: number, opts: { compact?: boolean } = {}) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.compact ? 1 : 0,
  }).format(n)
}

export function formatNumber(n: number, opts: { compact?: boolean } = {}) {
  return new Intl.NumberFormat('en-US', {
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.compact ? 1 : 0,
  }).format(n)
}

export function formatPercent(fraction: number, digits = 1) {
  return `${(fraction * 100).toFixed(digits)}%`
}

export function pctDelta(current: number, previous: number): number | undefined {
  if (previous === 0) return undefined
  return (current - previous) / Math.abs(previous)
}
