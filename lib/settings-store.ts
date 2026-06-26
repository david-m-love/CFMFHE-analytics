import { decrypt, encrypt } from './crypto'
import { kvGet, kvSet } from './credentials-store'

// Small encrypted settings store (COGS model, ad-spend assumptions, etc.) on
// the same KV backend as credentials.

export async function getSetting<T>(key: string): Promise<T | null> {
  const raw = await kvGet(`setting:${key}`)
  if (!raw) return null
  try {
    return JSON.parse(decrypt(raw)) as T
  } catch {
    return null
  }
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await kvSet(`setting:${key}`, encrypt(JSON.stringify(value)))
}
