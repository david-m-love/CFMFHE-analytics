'use client'

import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { GLOSSARY } from '@/lib/glossary'
import { cn } from '@/lib/utils'

/**
 * A small ⓘ that reveals a plain-English definition on click. Pass a glossary
 * key (`term`) or an explicit `text` definition.
 */
export function InfoTip({
  term,
  text,
  className,
}: {
  term?: string
  text?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const entry = term ? GLOSSARY[term] : undefined
  const title = entry?.term
  const body = text ?? entry?.definition
  if (!body) return null

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <span ref={ref} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-label={title ?? 'Definition'}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="text-text-3 transition-colors hover:text-accent-blue"
      >
        <Info size={13} />
      </button>
      {open && (
        <span className="absolute left-1/2 top-5 z-30 w-56 -translate-x-1/2 rounded-md border border-border bg-card p-2.5 text-left shadow-lg">
          {title && <span className="mb-1 block font-medium text-ink">{title}</span>}
          <span className="block text-xs leading-relaxed text-text-2">{body}</span>
        </span>
      )}
    </span>
  )
}
