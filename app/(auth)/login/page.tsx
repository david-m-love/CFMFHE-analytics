'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) {
      setError('Invalid email or password.')
    } else {
      router.push(callbackUrl)
      router.refresh()
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-text-2">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent-blue"
          placeholder="you@cfmfhe.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-text-2">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent-blue"
          placeholder="••••••••"
        />
      </div>
      {error && <p className="text-xs text-accent-red">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-accent-blue">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" aria-hidden>
              <path
                fill="currentColor"
                d="M12 20s-7-4.6-7-9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 3.5C19 15.4 12 20 12 20Z"
              />
            </svg>
          </span>
          <h1 className="mt-3 text-2xl text-ink">CFMFHE Analytics</h1>
          <p className="mt-1 text-sm text-text-2">Sign in to view the dashboard.</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-card">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center font-mono text-[11px] text-text-3">
          Confidential — Come Follow Me FHE leadership only.
        </p>
      </div>
    </div>
  )
}
