import { NextResponse } from 'next/server'
import {
  type ConnId,
  CONNECTION_ORDER,
  testAllConnections,
  testConnection,
} from '@/lib/connections'
import { secureModeEnabled } from '@/lib/auth'
import { persistenceAvailable } from '@/lib/credentials-store'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get('source') as ConnId | null
  const connections =
    source && CONNECTION_ORDER.includes(source)
      ? [await testConnection(source)]
      : await testAllConnections()
  return NextResponse.json({
    connections,
    secureMode: secureModeEnabled(),
    persistent: persistenceAvailable(),
  })
}
