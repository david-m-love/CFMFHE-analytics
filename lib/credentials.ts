import { CONNECTION_DEFS, type ConnId } from './connection-defs'
import { getStoredCredential } from './credentials-store'

/**
 * Resolves a connection's credential values. Stored (in-app, encrypted)
 * values take precedence over environment-variable fallbacks. Returns only
 * non-empty fields.
 */
export async function resolveCredential(id: ConnId): Promise<Record<string, string>> {
  const def = CONNECTION_DEFS[id]
  const fromEnv: Record<string, string> = {}
  for (const field of def.fields) {
    const envName = def.env[field.key]
    const v = envName ? process.env[envName] : undefined
    if (v) fromEnv[field.key] = v
  }
  let stored: Record<string, string> | null = null
  try {
    stored = await getStoredCredential(id)
  } catch {
    stored = null
  }
  const merged = { ...fromEnv, ...(stored ?? {}) }
  // drop empties
  return Object.fromEntries(Object.entries(merged).filter(([, v]) => v && v.trim()))
}

/** Which fields are currently set, and where they came from. */
export async function credentialSource(id: ConnId): Promise<'stored' | 'env' | 'none'> {
  const stored = await getStoredCredential(id).catch(() => null)
  if (stored && Object.keys(stored).length) return 'stored'
  const def = CONNECTION_DEFS[id]
  const hasEnv = def.fields.some((f) => def.env[f.key] && process.env[def.env[f.key]])
  return hasEnv ? 'env' : 'none'
}
