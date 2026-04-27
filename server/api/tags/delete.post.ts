import { createError, defineEventHandler, readBody } from 'h3'
import { deleteTagSchema } from '~/shared/schemas/tag'
import { deleteTag } from '~/server/utils/tags'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'
import { recordAudit } from '~/server/utils/audit-log'

export default defineEventHandler(async (event) => {
  const actor = await requirePermission(event, PERMISSIONS.TAGS_MANAGE)
  const parsed = deleteTagSchema.safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid tag payload',
    })
  }

  const tag = await deleteTag(event, parsed.data.id)

  if (!tag) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tag not found',
    })
  }

  recordAudit(event, {
    actor,
    action: 'delete',
    entityType: 'tag',
    entityId: tag.id,
    entityLabel: tag.name,
  })

  return {
    ok: true,
    id: tag.id,
  }
})

