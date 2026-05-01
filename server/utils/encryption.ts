import crypto from 'node:crypto'

/**
 * Encryption utility for sensitive data like API keys
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Get encryption key from environment variable
 * Falls back to a default key for development (NOT SECURE FOR PRODUCTION)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || 'dev-encryption-key-change-in-production-32bytes'
  
  // Ensure key is exactly 32 bytes for AES-256
  const hash = crypto.createHash('sha256').update(key).digest()
  return hash
}

/**
 * Encrypt a string value
 * Returns base64-encoded string containing IV + encrypted data + auth tag
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  
  const authTag = cipher.getAuthTag()
  
  // Combine IV + encrypted data + auth tag
  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, 'base64'),
    authTag,
  ])
  
  return combined.toString('base64')
}

/**
 * Decrypt an encrypted string
 * Expects base64-encoded string containing IV + encrypted data + auth tag
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey()
  const combined = Buffer.from(encryptedData, 'base64')
  
  // Extract IV, encrypted data, and auth tag
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH)
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encrypted.toString('base64'), 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}
