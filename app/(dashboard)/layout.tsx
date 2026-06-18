import { Sidebar } from '@/components/sidebar'
import { StoreFilter } from '@/components/StoreFilter'
import { DateRangePicker } from '@/components/DateRangePicker'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-paper/80 px-6 py-3 backdrop-blur">
          <div className="ml-auto flex items-center gap-3">
            <StoreFilter />
            <DateRangePicker />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  )
}
