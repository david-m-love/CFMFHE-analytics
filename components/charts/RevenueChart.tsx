'use client'

import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyRevenuePoint } from '@/lib/metrics'
import { formatCurrency } from '@/lib/utils'
import { ChartTooltip } from './ChartTooltip'

const GRID = 'rgba(28,27,24,0.07)'
const AXIS = '#9C9890'

export function RevenueChart({ data }: { data: MonthlyRevenuePoint[] }) {
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
          tickFormatter={(v) => formatCurrency(v, { compact: true })}
          tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ fill: 'rgba(28,27,24,0.04)' }}
          content={<ChartTooltip formatter={(v) => formatCurrency(Number(v))} />}
        />
        <Bar dataKey="newRevenue" name="New" stackId="r" fill="#3B6FA0" radius={[0, 0, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.month} fillOpacity={d.isJanuary ? 0.55 : 1} />
          ))}
        </Bar>
        <Bar
          dataKey="returningRevenue"
          name="Returning"
          stackId="r"
          fill="#6B5EA8"
          radius={[3, 3, 0, 0]}
        >
          {data.map((d) => (
            <Cell key={d.month} fillOpacity={d.isJanuary ? 0.55 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
