import { cn } from '@/lib/utils'

type Variant = 'primary' | 'outline' | 'ghost'

const variants: Record<Variant, string> = {
  primary:
    'bg-accent-blue text-white hover:bg-[#335f8a] border border-transparent',
  outline:
    'bg-card text-ink border border-border hover:bg-paper',
  ghost: 'bg-transparent text-text-2 hover:bg-paper border border-transparent',
}

export function Button({
  className,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
