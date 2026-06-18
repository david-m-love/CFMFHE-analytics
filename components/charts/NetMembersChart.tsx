'use client'

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyMembersPoint } from '@/lib/metrics'
import { ChartTooltip } from './ChartTooltip'

const GRID = 'rgba(28,27,24,0.07)'
const AXIS = '#9C9890'

export function NetMembersChart({ data }: { data: MonthlyMembersPoint[] }) {
  // churned shown as negative for a diverging look
  const shaped = data.map((d) => ({ ...d, churnedNeg: -d.churned }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={shaped} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip cursor={{ fill: 'rgba(28,27,24,0.04)' }} content={<ChartTooltip />} />
        <Bar dataKey="newMembers" name="New" fill="#2A7A58" radius={[3, 3, 0, 0]} />
        <Bar dataKey="churnedNeg" name="Churned (est.)" fill="#B04035" radius={[0, 0, 3, 3]} />
        <Line
          type="monotone"
          dataKey="net"
          name="Net"
          stroke="#1C1B18"
          strokeWidth={2}
          dot={{ r: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
