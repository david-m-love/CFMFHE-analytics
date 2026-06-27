'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SubscriberMonth } from '@/lib/klaviyo'
import { formatNumber } from '@/lib/utils'
import { ChartTooltip } from './ChartTooltip'

const GRID = 'rgba(28,27,24,0.07)'
const AXIS = '#9C9890'

export function SubscribersChart({ data }: { data: SubscriberMonth[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatNumber(v, { compact: true })}
          tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          cursor={{ fill: 'rgba(28,27,24,0.04)' }}
          content={<ChartTooltip formatter={(v) => formatNumber(Number(v))} />}
        />
        <Bar dataKey="email" name="Email" stackId="s" fill="#2A7A58" radius={[0, 0, 0, 0]} />
        <Bar dataKey="sms" name="SMS" stackId="s" fill="#6B5EA8" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
