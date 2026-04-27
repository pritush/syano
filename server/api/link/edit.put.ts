import { createError, defineEventHandler, readBody } from 'h3'
import { updateLinkSchema } from '~/shared/schemas/link'
import { updateLink } from '~/server/utils/link-store'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'
import { recordAudit } from '~/server/utils/audit-log'

export default defineEventHandler(async (event) => {
  const actor = await requirePermission(event, PERMISSIONS.LINKS_EDIT)
  const body = await readBody(event)
  const parsed = updateLinkSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid link payload',
    })
  }

  const link = await updateLink(event, parsed.data)

  if (!link) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Link not found',
    })
  }

  recordAudit(event, {
    actor,
    action: 'update',
    entityType: 'link',
    entityId: link.slug,
    entityLabel: link.slug,
    details: { url: link.url },
  })

  return link
})

