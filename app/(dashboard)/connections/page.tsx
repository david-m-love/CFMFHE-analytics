'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ConnStatus = 'connected' | 'not_configured' | 'error'

interface ConnResult {
  id: string
  label: string
  description: string
  status: ConnStatus
  detail?: string
  fix?: string
  checkedAt: string
}

const STATUS_META: Record<
  ConnStatus,
  { label: string; dot: string; text: string }
> = {
  connected: { label: 'Connected', dot: 'bg-accent-green', text: 'text-accent-green' },
  not_configured: { label: 'Not connected', dot: 'bg-text-3', text: 'text-text-3' },
  error: { label: 'Needs repair', dot: 'bg-accent-red', text: 'text-accent-red' },
}

function StatusDot({ status }: { status: ConnStatus }) {
  const m = STATUS_META[status]
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {status === 'connected' && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-60" />
      )}
      <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', m.dot)} />
    </span>
  )
}

export default function ConnectionsPage() {
  const [results, setResults] = useState<ConnResult[]>([])
  const [loadingAll, setLoadingAll] = useState(true)
  const [testingId, setTestingId] = useState<string | null>(null)

  const testAll = useCallback(async () => {
    setLoadingAll(true)
    try {
      const res = await fetch('/api/connections', { cache: 'no-store' })
      setResults(await res.json())
    } finally {
      setLoadingAll(false)
    }
  }, [])

  const testOne = useCallback(async (id: string) => {
    setTestingId(id)
    try {
      const res = await fetch(`/api/connections?source=${id}`, { cache: 'no-store' })
      const [updated] = (await res.json()) as ConnResult[]
      setResults((prev) => prev.map((r) => (r.id === id ? updated : r)))
    } finally {
      setTestingId(null)
    }
  }, [])

  useEffect(() => {
    testAll()
  }, [testAll])

  const connected = results.filter((r) => r.status === 'connected').length
  const broken = results.filter((r) => r.status === 'error').length

  return (
    <>
      <PageHeader
        title="Connections"
        description="Live status of every data source. Green means it's firing; red means it needs repair."
      />

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-text-2">
          {loadingAll && !results.length ? (
            'Checking connections…'
          ) : (
            <>
              <span className="font-medium text-ink">{connected}</span> of{' '}
              <span className="font-medium text-ink">{results.length}</span> connected
              {broken > 0 && (
                <span className="ml-2 text-accent-red">· {broken} need repair</span>
              )}
            </>
          )}
        </p>
        <Button variant="outline" onClick={testAll} disabled={loadingAll}>
          <RefreshCw size={14} className={cn(loadingAll && 'animate-spin')} />
          Test all
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {(results.length ? results : SKELETON).map((r, i) => {
          const skeleton = !results.length
          const meta = STATUS_META[r.status]
          return (
            <Card key={r.id ?? i}>
              <CardBody className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusDot status={r.status} />
                      <h3 className="font-serif text-lg text-ink">{r.label}</h3>
                    </div>
                    <p className="mt-0.5 text-sm text-text-2">{r.description}</p>
                  </div>
                  {!skeleton && (
                    <span className={cn('shrink-0 font-mono text-xs', meta.text)}>
                      {meta.label}
                    </span>
                  )}
                </div>

                {!skeleton && (
                  <div className="mt-3 space-y-2">
                    {r.detail && <p className="text-sm text-ink">{r.detail}</p>}
                    {r.status !== 'connected' && r.fix && (
                      <p className="flex gap-1.5 rounded-md bg-paper px-2.5 py-2 text-xs text-text-2">
                        <Wrench size={13} className="mt-0.5 shrink-0 text-text-3" />
                        {r.fix}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono text-[10px] text-text-3">
                        {r.checkedAt
                          ? `Checked ${new Date(r.checkedAt).toLocaleTimeString('en-US')}`
                          : ''}
                      </span>
                      <Button
                        variant="ghost"
                        onClick={() => testOne(r.id)}
                        disabled={testingId === r.id}
                        className="text-xs"
                      >
                        <RefreshCw
                          size={12}
                          className={cn(testingId === r.id && 'animate-spin')}
                        />
                        {r.status === 'error' ? 'Retry' : 'Test'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          )
        })}
      </div>

      <p className="mt-5 max-w-2xl text-xs text-text-3">
        This page only <em>tests</em> connections — it doesn’t store any keys yet.
        In-app credential entry (so you never open Vercel) is the next step, and
        it’ll come with a login to keep your keys and data private.
      </p>
    </>
  )
}

const SKELETON: ConnResult[] = [
  { id: 's1', label: '', description: '', status: 'not_configured', checkedAt: '' },
  { id: 's2', label: '', description: '', status: 'not_configured', checkedAt: '' },
  { id: 's3', label: '', description: '', status: 'not_configured', checkedAt: '' },
  { id: 's4', label: '', description: '', status: 'not_configured', checkedAt: '' },
]
