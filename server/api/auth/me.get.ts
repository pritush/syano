import { defineEventHandler } from 'h3'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    permissions: user.permissions,
    isRoot: user.isRoot,
  }
})
