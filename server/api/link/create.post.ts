import { createError, defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { createLinkSchema } from '~/shared/schemas/link'
import { createLink, getLink, normalizeSlug } from '~/server/utils/link-store'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'
import { recordAudit } from '~/server/utils/audit-log'

export default defineEventHandler(async (event) => {
  const actor = await requirePermission(event, PERMISSIONS.LINKS_CREATE)
  const runtimeConfig = useRuntimeConfig(event)
  const body = await readBody(event)
  const parsed = createLinkSchema(runtimeConfig.public.slugDefaultLength).safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid link payload',
    })
  }

  if (parsed.data.slug) {
    const existing = await getLink(event, normalizeSlug(parsed.data.slug, runtimeConfig.caseSensitive))
    if (existing) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Slug already exists',
      })
    }
  }

  const link = await createLink(event, parsed.data)

  recordAudit(event, {
    actor,
    action: 'create',
    entityType: 'link',
    entityId: link.slug,
    entityLabel: link.slug,
    details: { url: link.url },
  })

  return link
})

