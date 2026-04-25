import { createError, defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { loginSchema } from '~/shared/schemas/user'
import { WILDCARD_PERMISSION } from '~/shared/permissions'
import { findUserByUsername, verifyPassword, signJWT } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid login payload',
    })
  }

  const { username, password } = parsed.data
  const config = useRuntimeConfig(event)

  // 1. Check root user (from .env)
  if (username === config.siteUser && password === config.siteToken) {
    const token = await signJWT({
      sub: 'root',
      username: config.siteUser,
      displayName: 'Root Admin',
      permissions: [WILDCARD_PERMISSION],
      isRoot: true,
    }, event)

    return {
      token,
      user: {
        id: 'root',
        username: config.siteUser,
        displayName: 'Root Admin',
        permissions: [WILDCARD_PERMISSION],
        isRoot: true,
      },
    }
  }

  // 2. Check database users
  const dbUser = await findUserByUsername(event, username)

  if (!dbUser) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid username or password',
    })
  }

  if (!dbUser.is_active) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Account is disabled. Contact your administrator.',
    })
  }

  const passwordValid = await verifyPassword(password, dbUser.password_hash)
  if (!passwordValid) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid username or password',
    })
  }

  const permissions = (dbUser.permissions || []) as string[]

  const token = await signJWT({
    sub: dbUser.id,
    username: dbUser.username,
    displayName: dbUser.display_name || dbUser.username,
    permissions,
    isRoot: false,
  }, event)

  return {
    token,
    user: {
      id: dbUser.id,
      username: dbUser.username,
      displayName: dbUser.display_name || dbUser.username,
      permissions,
      isRoot: false,
    },
  }
})
