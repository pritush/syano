import type { H3Event } from 'h3'
import { createError, getHeader } from 'h3'
import { hash, compare } from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { eq } from 'drizzle-orm'
import { useRuntimeConfig } from '#imports'
import { hasPermission as checkPermission, WILDCARD_PERMISSION, type PermissionKey } from '~/shared/permissions'
import { users } from '~/server/database/schema'
import { useDrizzle } from '~/server/utils/db'

// ── Types ─────────────────────────────────────────────────

export interface AuthUser {
  id: string
  username: string
  displayName: string
  permissions: string[]
  isRoot: boolean
}

interface JWTPayload {
  sub: string       // user id (or 'root')
  username: string
  displayName: string
  permissions: string[]
  isRoot: boolean
}

// ── Password Hashing ──────────────────────────────────────

const BCRYPT_COST = 10

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_COST)
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return compare(plain, hashed)
}

// ── JWT ───────────────────────────────────────────────────

const JWT_EXPIRY = '30d'

function getJWTSecret(event?: H3Event): Uint8Array {
  const config = useRuntimeConfig(event)
  const secret = config.siteToken
  if (!secret) {
    throw createError({ statusCode: 500, statusMessage: 'JWT secret (NUXT_SITE_TOKEN) is not configured' })
  }
  return new TextEncoder().encode(secret)
}

export async function signJWT(payload: JWTPayload, event?: H3Event): Promise<string> {
  const secret = getJWTSecret(event)
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .setIssuer('syano')
    .sign(secret)
}

export async function verifyJWTToken(token: string, event?: H3Event): Promise<JWTPayload | null> {
  try {
    const secret = getJWTSecret(event)
    const { payload } = await jwtVerify(token, secret, { issuer: 'syano' })
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

// ── Auth Extraction ───────────────────────────────────────

/**
 * Extract authenticated user from request.
 * Supports both JWT tokens and legacy raw-token auth (for root user).
 */
export async function getAuthUser(event: H3Event): Promise<AuthUser | null> {
  const authorization = getHeader(event, 'authorization') || ''

  if (!authorization.startsWith('Bearer ')) {
    return null
  }

  const token = authorization.slice(7)
  const config = useRuntimeConfig(event)

  // 1. Try JWT verification first
  const jwtPayload = await verifyJWTToken(token, event)
  if (jwtPayload) {
    return {
      id: jwtPayload.sub,
      username: jwtPayload.username,
      displayName: jwtPayload.displayName,
      permissions: jwtPayload.permissions,
      isRoot: jwtPayload.isRoot,
    }
  }

  // 2. Legacy fallback: raw site token for root user
  const legacyUser = getHeader(event, 'x-site-user') || ''
  if (token === config.siteToken && legacyUser === config.siteUser) {
    return {
      id: 'root',
      username: config.siteUser,
      displayName: 'Root Admin',
      permissions: [WILDCARD_PERMISSION],
      isRoot: true,
    }
  }

  return null
}

/**
 * Require authentication. Throws 401 if not authenticated.
 * Attaches user to event.context.auth.
 */
export async function requireAuth(event: H3Event): Promise<AuthUser> {
  // Re-use auth set by middleware if available
  if (event.context.auth) {
    return event.context.auth as AuthUser
  }

  const user = await getAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  event.context.auth = user
  return user
}

/**
 * Require specific permissions. Throws 403 if user lacks any.
 * Also ensures authentication (throws 401 if not logged in).
 */
export async function requirePermission(event: H3Event, ...permissions: PermissionKey[]): Promise<AuthUser> {
  const user = await requireAuth(event)

  for (const perm of permissions) {
    if (!checkPermission(user.permissions, perm)) {
      throw createError({
        statusCode: 403,
        statusMessage: `Forbidden: requires "${perm}" permission`,
      })
    }
  }

  return user
}

// ── User DB Helpers ───────────────────────────────────────

export async function findUserByUsername(event: H3Event, username: string) {
  const db = await useDrizzle(event)
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1)
  return rows[0] ?? null
}

export async function findUserById(event: H3Event, id: string) {
  const db = await useDrizzle(event)
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return rows[0] ?? null
}
