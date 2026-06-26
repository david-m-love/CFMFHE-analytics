import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getGuide } from '@/lib/how-to'

export default function HowToPage({ params }: { params: { slug: string } }) {
  const guide = getGuide(params.slug)
  if (!guide) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/connections" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-2 hover:text-ink">
        <ArrowLeft size={15} /> Back to Connections
      </Link>

      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-2xl text-ink">{guide.title}</h1>
        {guide.estimate && <Badge tone="neutral">{guide.estimate}</Badge>}
      </div>
      <p className="mb-6 text-sm leading-relaxed text-text-2">{guide.intro}</p>

      <ol className="space-y-3">
        {guide.steps.map((step, i) => (
          <li key={i}>
            <Card>
              <CardBody className="flex gap-3 pt-4">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-blue font-mono text-sm font-medium text-white">
                  {i + 1}
                </span>
                <div>
                  <div className="font-medium text-ink">{step.title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-text-2">{step.detail}</p>
                </div>
              </CardBody>
            </Card>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-xs text-text-3">
        Stuck on a step? These instructions live in the app so any teammate can follow them.
      </p>
    </div>
  )
}
