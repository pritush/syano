import { defineEventHandler } from 'h3'
import { requireAuth } from '~/server/utils/auth'

defineRouteMeta({
  openAPI: {
    tags: ['Authentication'],
    summary: 'Get current user',
    description: 'Retrieve information about the currently authenticated user',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Current user information',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/User' },
          },
        },
      },
      401: {
        description: 'Not authenticated',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
  },
})

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
