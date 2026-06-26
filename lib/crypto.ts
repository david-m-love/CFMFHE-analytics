import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'crypto'

// AES-256-GCM encryption for credentials at rest. The key is derived from
// APP_ENCRYPTION_KEY (any string) via SHA-256 → 32 bytes.

export function encryptionConfigured(): boolean {
  return !!process.env.APP_ENCRYPTION_KEY
}

function key(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY
  if (!secret) throw new Error('APP_ENCRYPTION_KEY is not set')
  return createHash('sha256').update(secret).digest()
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

// Password hashing (scrypt). Stored as "salt:hash" hex.
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const dk = scryptSync(password, salt, 32)
  return `${salt.toString('hex')}:${dk.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const dk = scryptSync(password, Buffer.from(saltHex, 'hex'), 32)
  const expected = Buffer.from(hashHex, 'hex')
  return dk.length === expected.length && timingSafeEqual(dk, expected)
}
