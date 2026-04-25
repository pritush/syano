import { createError, defineEventHandler, getQuery } from 'h3'
import { analyticsQuerySchema } from '~/shared/schemas/analytics'
import { getAnalyticsViews } from '~/server/utils/analytics'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.ANALYTICS_READ)
  const parsed = analyticsQuerySchema.safeParse(getQuery(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid analytics query',
    })
  }

  return {
    items: await getAnalyticsViews(event, parsed.data),
  }
})

