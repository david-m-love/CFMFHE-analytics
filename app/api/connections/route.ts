import { NextResponse } from 'next/server'
import {
  type ConnId,
  CONNECTION_ORDER,
  testAllConnections,
  testConnection,
} from '@/lib/connections'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get('source') as ConnId | null
  if (source && CONNECTION_ORDER.includes(source)) {
    return NextResponse.json([await testConnection(source)])
  }
  return NextResponse.json(await testAllConnections())
}
