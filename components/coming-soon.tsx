import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Construction } from 'lucide-react'

export function ComingSoon({
  phase,
  items,
}: {
  phase: string
  items: string[]
}) {
  return (
    <Card>
      <CardBody className="pt-5">
        <div className="flex items-center gap-2">
          <Construction size={18} className="text-accent-amber" />
          <span className="font-serif text-lg text-ink">Planned</span>
          <Badge tone="amber">{phase}</Badge>
        </div>
        <p className="mt-2 text-sm text-text-2">
          This dashboard isn’t built yet. It will include:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-text-2">
          {items.map((it) => (
            <li key={it} className="flex gap-2">
              <span className="text-text-3">•</span>
              {it}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}
