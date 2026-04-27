import { createError, defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { deleteLinkSchema } from '~/shared/schemas/link'
import { deleteLink } from '~/server/utils/link-store'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'
import { recordAudit } from '~/server/utils/audit-log'

export default defineEventHandler(async (event) => {
  const actor = await requirePermission(event, PERMISSIONS.LINKS_DELETE)
  const runtimeConfig = useRuntimeConfig(event)

  if (runtimeConfig.public.previewMode) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Deletes are disabled in preview mode',
    })
  }

  const body = await readBody(event)
  const parsed = deleteLinkSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid delete payload',
    })
  }

  const deleted = await deleteLink(event, parsed.data.slug)

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Link not found',
    })
  }

  recordAudit(event, {
    actor,
    action: 'delete',
    entityType: 'link',
    entityId: deleted.slug,
    entityLabel: deleted.slug,
    details: { url: deleted.url },
  })

  return {
    ok: true,
    slug: deleted.slug,
  }
})

