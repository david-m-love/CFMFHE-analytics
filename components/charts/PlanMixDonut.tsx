'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { PlanMixSlice } from '@/lib/metrics'
import { ChartTooltip } from './ChartTooltip'

const COLORS = ['#3B6FA0', '#6B5EA8', '#2A7A58', '#B87020', '#B04035', '#9C9890']

export function PlanMixDonut({ data }: { data: PlanMixSlice[] }) {
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={48}
            outerRadius={72}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="space-y-1.5 text-sm">
        {data.map((s, i) => (
          <li key={s.type} className="flex items-center gap-2 text-text-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="max-w-[180px] truncate">{s.label}</span>
            <span className="ml-auto font-mono text-xs tabular-nums text-ink">
              {s.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
