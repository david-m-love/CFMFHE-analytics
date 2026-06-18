import { ToggleWelcome } from '@/components/modals/welcome'
import { CfmfheLogo } from '@/components/cfmfhe-logo'
import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

export async function Header({ className }: Props) {
  return (
    <header className={cn('flex items-center justify-between', className)}>
      <CfmfheLogo className="ml-1 md:ml-2.5" />
      <div className="flex items-center ml-auto space-x-1.5">
        <ToggleWelcome />
      </div>
    </header>
  )
}
