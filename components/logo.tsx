import { cn } from '@/lib/utils'

/** Compact CFMFHE mark: heart badge + wordmark. Tuned for the dark sidebar. */
export function Logo({
  className,
  subtitle = true,
}: {
  className?: string
  subtitle?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent-blue">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" aria-hidden>
          <path
            fill="currentColor"
            d="M12 20s-7-4.6-7-9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 3.5C19 15.4 12 20 12 20Z"
          />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block font-serif text-base text-white">CFMFHE</span>
        {subtitle && (
          <span className="block font-mono text-[10px] uppercase tracking-wider text-white/60">
            Analytics
          </span>
        )}
      </span>
    </div>
  )
}
