'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { HelpCircle, Lock, Plus, RefreshCw, Wrench, X } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CONNECTION_DEFS, type ConnId } from '@/lib/connection-defs'
import { useDashboard } from '@/store/dashboard'
import { STORE_LABELS } from '@/types'
import type { StoreSource } from '@/types'
import { cn } from '@/lib/utils'

type ConnStatus = 'connected' | 'not_configured' | 'error'

interface ConnResult {
  id: ConnId
  label: string
  description: string
  status: ConnStatus
  detail?: string
  fix?: string
  source: 'stored' | 'env' | 'none'
  checkedAt: string
}

interface ApiResponse {
  connections: ConnResult[]
  secureMode: boolean
  persistent: boolean
}

const STATUS_META: Record<ConnStatus, { label: string; dot: string; text: string }> = {
  connected: { label: 'Connected', dot: 'bg-accent-green', text: 'text-accent-green' },
  not_configured: { label: 'Not connected', dot: 'bg-text-3', text: 'text-text-3' },
  error: { label: 'Needs repair', dot: 'bg-accent-red', text: 'text-accent-red' },
}

function StatusDot({ status }: { status: ConnStatus }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {status === 'connected' && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-60" />
      )}
      <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', STATUS_META[status].dot)} />
    </span>
  )
}

export default function ConnectionsPage() {
  const [results, setResults] = useState<ConnResult[]>([])
  const [secureMode, setSecureMode] = useState(false)
  const [persistent, setPersistent] = useState(false)
  const [loadingAll, setLoadingAll] = useState(true)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [editorId, setEditorId] = useState<ConnId | null>(null)

  const load = useCallback(async () => {
    setLoadingAll(true)
    try {
      const res = await fetch('/api/connections', { cache: 'no-store' })
      const data: ApiResponse = await res.json()
      setResults(data.connections)
      setSecureMode(data.secureMode)
      setPersistent(data.persistent)
    } finally {
      setLoadingAll(false)
    }
  }, [])

  const testOne = useCallback(async (id: string) => {
    setTestingId(id)
    try {
      const res = await fetch(`/api/connections?source=${id}`, { cache: 'no-store' })
      const data: ApiResponse = await res.json()
      const updated = data.connections[0]
      setResults((prev) => prev.map((r) => (r.id === id ? updated : r)))
    } finally {
      setTestingId(null)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const connected = results.filter((r) => r.status === 'connected').length
  const broken = results.filter((r) => r.status === 'error').length
  const editing = editorId ? results.find((r) => r.id === editorId) ?? null : null

  return (
    <>
      <PageHeader
        title="Connections"
        description="Live status of every data source. Green means it's firing; red means it needs repair."
        showSource={false}
      />

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-text-2">
          {loadingAll && !results.length ? (
            'Checking connections…'
          ) : (
            <>
              <span className="font-medium text-ink">{connected}</span> of{' '}
              <span className="font-medium text-ink">{results.length}</span> connected
              {broken > 0 && <span className="ml-2 text-accent-red">· {broken} need repair</span>}
            </>
          )}
        </p>
        <Button variant="outline" onClick={load} disabled={loadingAll}>
          <RefreshCw size={14} className={cn(loadingAll && 'animate-spin')} />
          Test all
        </Button>
      </div>

      <IncludedSources />

      {!secureMode && !loadingAll && <SecureModeNotice />}
      {secureMode && !persistent && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-[#ecdcc2] bg-[#f6eddf] px-3 py-2 text-xs text-accent-amber">
          <Wrench size={14} className="shrink-0" />
          Secure mode is on, but no database is connected — saved credentials won't survive a
          restart until you add Vercel KV (KV_REST_API_URL / KV_REST_API_TOKEN).
        </div>
      )}

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
                      {!skeleton && CONNECTION_DEFS[r.id]?.docsSlug && (
                        <Link
                          href={`/how-to/${CONNECTION_DEFS[r.id].docsSlug}`}
                          title={`How to connect ${r.label}`}
                          className="text-text-3 hover:text-accent-blue"
                        >
                          <HelpCircle size={15} />
                        </Link>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-text-2">{r.description}</p>
                  </div>
                  {!skeleton && (
                    <span className={cn('shrink-0 font-mono text-xs', meta.text)}>{meta.label}</span>
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
                        {r.source === 'stored' && 'Saved in app · '}
                        {r.source === 'env' && 'From env · '}
                        {r.checkedAt ? `Checked ${new Date(r.checkedAt).toLocaleTimeString('en-US')}` : ''}
                      </span>
                      <div className="flex gap-1">
                        {secureMode && (
                          <Button variant="ghost" onClick={() => setEditorId(r.id)} className="text-xs">
                            <Plus size={12} />
                            {r.source === 'stored' ? 'Edit' : 'Connect'}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() => testOne(r.id)}
                          disabled={testingId === r.id}
                          className="text-xs"
                        >
                          <RefreshCw size={12} className={cn(testingId === r.id && 'animate-spin')} />
                          {r.status === 'error' ? 'Retry' : 'Test'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          )
        })}
      </div>

      {editing && (
        <ConnectionEditor
          result={editing}
          onClose={() => setEditorId(null)}
          onSaved={(updated) => {
            setResults((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
            setEditorId(null)
          }}
        />
      )}
    </>
  )
}

function IncludedSources() {
  const { excludedSources, toggleSource } = useDashboard()
  const stores = Object.keys(STORE_LABELS) as StoreSource[]
  return (
    <Card className="mb-4">
      <CardBody className="pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg text-ink">Included data</h3>
            <p className="text-sm text-text-2">
              Analytics combine every store by default. Toggle a store off to exclude it
              from your numbers (recommended: leave all on).
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {stores.map((s) => {
            const on = !excludedSources.includes(s)
            return (
              <button
                key={s}
                onClick={() => toggleSource(s)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                  on
                    ? 'border-accent-blue bg-[#eaf0f6] text-accent-blue'
                    : 'border-border text-text-3 line-through',
                )}
              >
                {on ? '✓ ' : ''}
                {STORE_LABELS[s]}
              </button>
            )
          })}
        </div>
      </CardBody>
    </Card>
  )
}

function SecureModeNotice() {
  return (
    <Card className="mb-4">
      <CardBody className="pt-4">
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-accent-blue" />
          <span className="font-serif text-lg text-ink">Enable in-app credentials</span>
        </div>
        <p className="mt-2 text-sm text-text-2">
          This page tests connections now. To <strong>enter and save API keys here</strong> (no
          Vercel needed afterward), turn on secure mode by setting these in your Vercel project:
        </p>
        <ul className="mt-2 space-y-1 font-mono text-xs text-text-2">
          <li>• <strong>NEXTAUTH_SECRET</strong> — random string (openssl rand -base64 32)</li>
          <li>• <strong>NEXTAUTH_URL</strong> — your site URL</li>
          <li>• <strong>DASHBOARD_USERS</strong> — turns on login (Name|email|password,…)</li>
          <li>• <strong>APP_ENCRYPTION_KEY</strong> — random string; encrypts saved keys</li>
          <li>• <strong>KV_REST_API_URL / KV_REST_API_TOKEN</strong> — Vercel KV, so saves persist</li>
        </ul>
        <p className="mt-2 text-xs text-text-3">
          Until then the app stays open (no login) and runs on sample data.
        </p>
      </CardBody>
    </Card>
  )
}

function ConnectionEditor({
  result,
  onClose,
  onSaved,
}: {
  result: ConnResult
  onClose: () => void
  onSaved: (r: ConnResult) => void
}) {
  const def = CONNECTION_DEFS[result.id]
  const [fields, setFields] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(action: 'save' | 'clear') {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/connections/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: result.id, action, fields }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }
      onSaved(data.result as ConnResult)
    } catch {
      setError('Network error.')
    } finally {
      setSaving(false)
    }
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <button aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-card p-4 shadow-xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[520px] sm:max-w-[92vw] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="font-serif text-lg text-ink">Connect {def.label}</h2>
          {def.docsSlug && (
            <Link
              href={`/how-to/${def.docsSlug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs text-accent-blue hover:underline"
            >
              <HelpCircle size={14} /> Setup guide
            </Link>
          )}
          <button onClick={onClose} className="ml-auto rounded-md p-1 text-text-3 hover:bg-paper" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {def.setup && <p className="mb-3 rounded-md bg-paper px-3 py-2 text-xs text-text-2">{def.setup}</p>}

        <div className="space-y-3">
          {def.fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-medium text-text-2">{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea
                  rows={3}
                  value={fields[f.key] ?? ''}
                  onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 font-mono text-xs outline-none focus:border-accent-blue"
                />
              ) : (
                <input
                  type={f.type === 'password' ? 'password' : 'text'}
                  value={fields[f.key] ?? ''}
                  onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent-blue"
                />
              )}
            </div>
          ))}
        </div>

        {error && <p className="mt-3 text-xs text-accent-red">{error}</p>}

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
          {result.source === 'stored' ? (
            <button
              onClick={() => submit('clear')}
              disabled={saving}
              className="text-xs text-accent-red hover:underline"
            >
              Disconnect
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md px-3 py-2 text-sm text-text-2 hover:bg-paper">
              Cancel
            </button>
            <Button onClick={() => submit('save')} disabled={saving}>
              {saving ? 'Testing…' : 'Test & Save'}
            </Button>
          </div>
        </div>
        {def.kind === 'oauth' && (
          <a
            href={`/api/oauth/${def.id}/authorize`}
            className="mt-3 flex w-full items-center justify-center rounded-md bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-[#335f8a]"
          >
            Connect with {def.label}
          </a>
        )}
        <p className="mt-2 font-mono text-[10px] text-text-3">
          {def.kind === 'oauth'
            ? 'Save your app keys first, then authorize. Tokens are encrypted before storage.'
            : 'Keys are encrypted before storage and never shown again after saving.'}
        </p>
      </div>
    </div>,
    document.body,
  )
}

const SKELETON: ConnResult[] = (
  ['sheets', 'shopify', 'klaviyo', 'ga4', 'anthropic', 'quickbooks'] as ConnId[]
).map((id) => ({ id, label: '', description: '', status: 'not_configured', source: 'none', checkedAt: '' }))
