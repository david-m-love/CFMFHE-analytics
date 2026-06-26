import { Redis } from '@upstash/redis'
import { decrypt, encrypt } from './crypto'
import type { ConnId } from './connection-defs'

// Persists encrypted credential blobs. Uses Vercel KV / Upstash Redis when
// configured (REST env vars), otherwise an in-memory fallback so the app runs
// in preview — the fallback does NOT survive restarts.

const memory = new Map<string, string>()

function client(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export function persistenceAvailable(): boolean {
  return client() !== null
}

const keyFor = (id: ConnId) => `cred:${id}`

export async function saveCredential(id: ConnId, data: Record<string, string>): Promise<void> {
  const payload = encrypt(JSON.stringify(data))
  const redis = client()
  if (redis) await redis.set(keyFor(id), payload)
  else memory.set(keyFor(id), payload)
}

export async function getStoredCredential(id: ConnId): Promise<Record<string, string> | null> {
  const redis = client()
  const raw = redis ? await redis.get<string>(keyFor(id)) : memory.get(keyFor(id))
  if (!raw) return null
  try {
    return JSON.parse(decrypt(raw)) as Record<string, string>
  } catch {
    return null
  }
}

export async function clearStoredCredential(id: ConnId): Promise<void> {
  const redis = client()
  if (redis) await redis.del(keyFor(id))
  else memory.delete(keyFor(id))
}
