import { createError, defineEventHandler, readBody } from 'h3'
import { SiteSettingsSchema } from '~/shared/schemas/settings'
import { saveSiteSettings } from '~/server/utils/site-settings'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'
import { recordAudit } from '~/server/utils/audit-log'

export default defineEventHandler(async (event) => {
  const actor = await requirePermission(event, PERMISSIONS.SETTINGS_MANAGE)
  const body = await readBody(event)
  const parsed = SiteSettingsSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid settings payload',
    })
  }

  const result = await saveSiteSettings(event, parsed.data)

  recordAudit(event, {
    actor,
    action: 'update',
    entityType: 'settings',
    entityId: 'default',
    entityLabel: 'Site Settings',
    details: { homepage_mode: parsed.data.homepage_mode },
  })

  return result
})
