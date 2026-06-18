import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

/**
 * CFMFHE wordmark: the flowing "cfmfhe" script paired with the circular
 * "Bringing Families to Christ" heart badge. Rendered as vector/text so it
 * stays crisp at any size and inherits the brand color tokens.
 */
export function CfmfheLogo({ className }: Props) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="font-script leading-none text-primary text-3xl md:text-4xl pb-1.5 select-none">
        cfmfhe
      </span>
      <CfmfheBadge className="h-7 w-7 md:h-8 md:w-8 shrink-0 text-foreground" />
      <span className="sr-only">CFMFHE — Bringing Families to Christ</span>
    </div>
  )
}

export function CfmfheBadge({ className }: Props) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Bringing families to Christ"
    >
      <defs>
        {/* Top arc reads left→right over the top; bottom arc is drawn
            right→left so its lettering sits upright along the bottom. */}
        <path id="cfmfhe-arc-top" d="M 20,50 A 30,30 0 0 1 80,50" fill="none" />
        <path id="cfmfhe-arc-bottom" d="M 80,50 A 30,30 0 0 1 20,50" fill="none" />
      </defs>
      <circle
        cx="50"
        cy="50"
        r="47"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="50"
        cy="50"
        r="38"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <text
        fill="currentColor"
        fontSize="8.5"
        fontWeight="600"
        letterSpacing="1.4"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <textPath href="#cfmfhe-arc-top" startOffset="50%" textAnchor="middle">
          BRINGING FAMILIES
        </textPath>
      </text>
      <text
        fill="currentColor"
        fontSize="8.5"
        fontWeight="600"
        letterSpacing="1.4"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <textPath
          href="#cfmfhe-arc-bottom"
          startOffset="50%"
          textAnchor="middle"
        >
          TO CHRIST
        </textPath>
      </text>
      <path
        d="M50 65 C 43 57, 35 52, 35 44.5 C 35 39.5, 39 36.5, 43.5 36.5 C 46.5 36.5, 48.8 38.4, 50 40.6 C 51.2 38.4, 53.5 36.5, 56.5 36.5 C 61 36.5, 65 39.5, 65 44.5 C 65 52, 57 57, 50 65 Z"
        fill="currentColor"
      />
    </svg>
  )
}
