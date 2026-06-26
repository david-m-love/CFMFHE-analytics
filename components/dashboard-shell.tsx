'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { StoreFilter } from '@/components/StoreFilter'
import { DateRangePicker } from '@/components/DateRangePicker'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)
  const pathname = usePathname()

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [navOpen])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden w-60 shrink-0 lg:block">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setNavOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 shadow-xl">
            <Sidebar onNavigate={() => setNavOpen(false)} />
            <button
              aria-label="Close menu"
              onClick={() => setNavOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border bg-paper/80 px-4 py-2.5 backdrop-blur md:px-6">
          <button
            aria-label="Open menu"
            onClick={() => setNavOpen(true)}
            className="shrink-0 rounded-md border border-border bg-card p-2 text-ink lg:hidden"
          >
            <Menu size={18} />
          </button>
          <span className="font-serif text-base text-ink lg:hidden">CFMFHE</span>
          <div className="ml-auto flex items-center gap-2 overflow-x-auto">
            <StoreFilter />
            <DateRangePicker />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  )
}
