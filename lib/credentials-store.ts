import { Redis } from '@upstash/redis'
import { decrypt, encrypt } from './crypto'
import type { ConnId } from './connection-defs'

// Persists encrypted blobs. Uses Vercel KV / Upstash Redis when configured
// (REST env vars), otherwise an in-memory fallback for preview — the fallback
// does NOT survive restarts.

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

// ── Generic KV ─────────────────────────────────────────────────────
export async function kvGet(key: string): Promise<string | null> {
  const redis = client()
  if (redis) return (await redis.get<string>(key)) ?? null
  return memory.get(key) ?? null
}

export async function kvSet(key: string, value: string): Promise<void> {
  const redis = client()
  if (redis) await redis.set(key, value)
  else memory.set(key, value)
}

export async function kvDel(key: string): Promise<void> {
  const redis = client()
  if (redis) await redis.del(key)
  else memory.delete(key)
}

// ── Credential blobs (encrypted) ───────────────────────────────────
const keyFor = (id: ConnId) => `cred:${id}`

export async function saveCredential(id: ConnId, data: Record<string, string>): Promise<void> {
  await kvSet(keyFor(id), encrypt(JSON.stringify(data)))
}

export async function getStoredCredential(id: ConnId): Promise<Record<string, string> | null> {
  const raw = await kvGet(keyFor(id))
  if (!raw) return null
  try {
    return JSON.parse(decrypt(raw)) as Record<string, string>
  } catch {
    return null
  }
}

export async function clearStoredCredential(id: ConnId): Promise<void> {
  await kvDel(keyFor(id))
}
