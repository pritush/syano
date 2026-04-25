import { createError, defineEventHandler, readBody } from 'h3'
import { requirePermission, hashPassword, findUserByUsername } from '~/server/utils/auth'
import { useDrizzle } from '~/server/utils/db'
import { users } from '~/server/database/schema'
import { createUserSchema } from '~/shared/schemas/user'
import { PERMISSIONS } from '~/shared/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.USERS_MANAGE)

  const body = await readBody(event)
  const parsed = createUserSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().fieldErrors
        ? Object.values(parsed.error.flatten().fieldErrors).flat().join(', ')
        : 'Invalid user payload',
    })
  }

  const { username, displayName, password, permissions } = parsed.data

  // Check for existing user with same username
  const existing = await findUserByUsername(event, username)
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A user with this username already exists',
    })
  }

  // Check that username doesn't match root user
  const config = useRuntimeConfig(event)
  if (username === config.siteUser) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This username is reserved for the root admin',
    })
  }

  const passwordHash = await hashPassword(password)

  const db = await useDrizzle(event)
  const [created] = await db.insert(users).values({
    username,
    display_name: displayName || null,
    password_hash: passwordHash,
    permissions: permissions as string[],
  }).returning({
    id: users.id,
    username: users.username,
    displayName: users.display_name,
    permissions: users.permissions,
    isActive: users.is_active,
    createdAt: users.created_at,
  })

  return created
})
