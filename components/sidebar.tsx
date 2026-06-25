'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Bot,
  LayoutDashboard,
  Mail,
  Package,
  TrendingUp,
} from 'lucide-react'
import { Logo } from './logo'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/membership', label: 'Membership', icon: TrendingUp },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/email', label: 'Email & SMS', icon: Mail },
  { href: '/traffic', label: 'Traffic', icon: BarChart3 },
  { href: '/ai', label: 'Ask Anything', icon: Bot },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-ink text-white">
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
        </ul>
      </nav>
      <div className="border-t border-white/10 px-5 py-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">
          Come Follow Me FHE
        </p>
      </div>
    </aside>
  )
}
