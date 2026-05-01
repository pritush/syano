import { defineEventHandler, getRouterParam, createError } from 'h3'
import { deleteTag } from '~/server/utils/tags'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'
import { recordAudit } from '~/server/utils/audit-log'

/**
 * Delete a tag
 * DELETE /api/v1/tags/:id
 * 
 * Authentication: Supports both JWT tokens (dashboard) and API keys (external)
 */
export default defineEventHandler(async (event) => {
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, 'tags:manage')
  
  // Rate limit (only for API key requests)
  if (auth.type === 'apikey') {
    await checkRateLimit(event, {
      id: auth.apiKeyId!,
      user_id: auth.userId,
      name: auth.apiKeyName!,
      permissions: auth.permissions,
      key_prefix: auth.apiKeyPrefix!
    }, '/api/v1/tags')
  }
  
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Tag ID parameter is required',
    })
  }

  const tag = await deleteTag(event, id)

  if (!tag) {
    throw createError({
      statusCode: 404,
      message: `Tag with ID '${id}' not found`,
    })
  }

  // Record audit log
  recordAudit(event, {
    actor: { id: auth.userId, username: auth.username || 'api-key', displayName: auth.displayName || auth.apiKeyName || 'API Key', permissions: auth.permissions, isRoot: auth.isRoot || false },
    action: 'delete',
    entityType: 'tag',
    entityId: tag.id,
    entityLabel: tag.name,
  })

  return {
    success: true,
    message: `Tag '${tag.name}' deleted successfully`,
  }
})
