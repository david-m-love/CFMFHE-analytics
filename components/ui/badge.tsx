import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red'

const tones: Record<Tone, string> = {
  neutral: 'bg-paper text-text-2 border-border',
  blue: 'bg-[#eaf0f6] text-accent-blue border-[#cfe0ee]',
  green: 'bg-[#e7f1ec] text-accent-green border-[#cfe6da]',
  amber: 'bg-[#f6eddf] text-accent-amber border-[#ecdcc2]',
  red: 'bg-[#f6e6e4] text-accent-red border-[#ecd0cc]',
}

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-mono font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}
