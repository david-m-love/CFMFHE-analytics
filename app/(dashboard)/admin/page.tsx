'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Role = 'admin' | 'user'
interface PublicUser {
  name: string
  email: string
  role: Role
  source: 'bootstrap' | 'db'
}

export default function AdminPage() {
  const [users, setUsers] = useState<PublicUser[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState('')

  // add-user form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/users', { cache: 'no-store' })
    if (res.status === 403 || res.status === 401) {
      setForbidden(true)
      setLoading(false)
      return
    }
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function call(method: string, body: object) {
    setError('')
    const res = await fetch('/api/users', {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      return false
    }
    setUsers(data.users ?? [])
    return true
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const ok = await call('POST', { name, email, password, role })
    setBusy(false)
    if (ok) {
      setName('')
      setEmail('')
      setPassword('')
      setRole('user')
    }
  }

  if (forbidden) {
    return (
      <>
        <PageHeader title="Team" />
        <Card>
          <CardBody className="pt-5 text-sm text-text-2">
            This area is for admins only.
          </CardBody>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Team" description="Manage who can access the dashboard." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardBody className="overflow-x-auto">
            {loading ? (
              <div className="h-24 animate-pulse rounded-md bg-paper" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wide text-text-3">
                    <th className="py-1.5 pr-3 font-normal">Name</th>
                    <th className="py-1.5 pr-3 font-normal">Role</th>
                    <th className="py-1.5 font-normal" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.email} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3">
                        <div className="text-ink">{u.name}</div>
                        <div className="text-xs text-text-3">{u.email}</div>
                      </td>
                      <td className="py-2 pr-3">
                        {u.source === 'bootstrap' ? (
                          <Badge tone="blue">
                            <ShieldCheck size={11} /> Owner
                          </Badge>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => call('PATCH', { email: u.email, role: e.target.value })}
                            className="rounded-md border border-border bg-white px-2 py-1 text-xs"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {u.source === 'db' && (
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${u.email}?`)) call('DELETE', { email: u.email })
                            }}
                            className="inline-flex items-center gap-1 text-xs text-accent-red hover:underline"
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 font-mono text-[10px] text-text-3">
              “Owner” accounts come from the deployment config and can’t be edited here.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add a member</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={onAdd} className="space-y-3">
              <Field label="Name" value={name} onChange={setName} placeholder="Jane Smith" />
              <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="jane@cfmfhe.com" />
              <Field label="Temporary password" value={password} onChange={setPassword} type="password" placeholder="6+ characters" />
              <div>
                <label className="mb-1 block text-xs font-medium text-text-2">Role</label>
                <div className="flex gap-2">
                  {(['user', 'admin'] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={cn(
                        'flex-1 rounded-md border px-3 py-2 text-sm capitalize',
                        role === r ? 'border-accent-blue bg-[#eaf0f6] text-accent-blue' : 'border-border text-text-2',
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-text-3">
                  Admins can manage members. Users get full dashboard access but can’t.
                </p>
              </div>
              {error && <p className="text-xs text-accent-red">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full">
                <UserPlus size={14} />
                {busy ? 'Adding…' : 'Add member'}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent-blue"
      />
    </div>
  )
}
