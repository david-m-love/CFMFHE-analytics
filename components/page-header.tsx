import { SourceBanner } from './SourceBanner'

export function PageHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl text-ink">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-text-2">{description}</p>
        )}
      </div>
      <div className="pt-1">
        <SourceBanner />
      </div>
    </div>
  )
}
