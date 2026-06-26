import { SourceBanner } from './SourceBanner'

export function PageHeader({
  title,
  description,
  showSource = true,
}: {
  title: string
  description?: string
  /** Show the orders/Google-Sheets status banner. Only relevant on
   *  order-based pages (Overview, Membership, Products). */
  showSource?: boolean
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl text-ink">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-text-2">{description}</p>
        )}
      </div>
      {showSource && (
        <div className="pt-1">
          <SourceBanner />
        </div>
      )}
    </div>
  )
}
