import { createError, defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { createLinkSchema } from '~/shared/schemas/link'
import { upsertLink } from '~/server/utils/link-store'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.LINKS_CREATE)
  const runtimeConfig = useRuntimeConfig(event)
  const body = await readBody(event)
  const parsed = createLinkSchema(runtimeConfig.public.slugDefaultLength).safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid link payload',
    })
  }

  return await upsertLink(event, parsed.data)
})

