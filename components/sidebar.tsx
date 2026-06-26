'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  BarChart3,
  Bot,
  Landmark,
  LayoutDashboard,
  LogOut,
  Mail,
  Package,
  PlugZap,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Logo } from './logo'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/ceo', label: 'CEO', icon: Landmark },
  { href: '/membership', label: 'Membership', icon: TrendingUp },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/email', label: 'Email & SMS', icon: Mail },
  { href: '/traffic', label: 'Traffic', icon: BarChart3 },
  { href: '/ai', label: 'Ask Anything', icon: Bot },
  { href: '/connections', label: 'Connections', icon: PlugZap },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin'

  return (
    <aside className="flex h-full w-full flex-col bg-ink text-white">
      <div className="px-5 py-5">
        <Logo />
      </div>
      <nav className="flex-1 px-3">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-white/10 text-white'
                      : 'text-white/65 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              </li>
            )
          })}
          {isAdmin && (
            <li>
              <Link
                href="/admin"
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  pathname.startsWith('/admin')
                    ? 'bg-white/10 text-white'
                    : 'text-white/65 hover:bg-white/5 hover:text-white',
                )}
              >
                <Users size={16} />
                Team
              </Link>
            </li>
          )}
        </ul>
      </nav>
      <div className="border-t border-white/10 px-3 py-3">
        {session?.user ? (
          <>
            <div className="px-2 pb-2 text-xs text-white/50">
              {session.user.name ?? session.user.email}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-white/65 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </>
        ) : (
          <p className="px-2 font-mono text-[10px] uppercase tracking-wider text-white/40">
            Come Follow Me FHE
          </p>
        )}
      </div>
    </aside>
  )
}
