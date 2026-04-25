import { createError, defineEventHandler, readBody } from 'h3'
import { createTagSchema } from '~/shared/schemas/tag'
import { createTag } from '~/server/utils/tags'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.TAGS_MANAGE)
  const parsed = createTagSchema.safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid tag payload',
    })
  }

  return await createTag(event, parsed.data.name)
})

