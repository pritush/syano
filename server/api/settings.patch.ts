import { createError, defineEventHandler, readBody } from 'h3'
import { SiteSettingsSchema } from '~/shared/schemas/settings'
import { saveSiteSettings } from '~/server/utils/site-settings'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.SETTINGS_MANAGE)
  const body = await readBody(event)
  const parsed = SiteSettingsSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid settings payload',
    })
  }

  return await saveSiteSettings(event, parsed.data)
})

