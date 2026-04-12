import { createError, defineEventHandler, getQuery } from 'h3'
import { analyticsQuerySchema } from '~/shared/schemas/analytics'
import { getAnalyticsMetrics } from '~/server/utils/analytics'

export default defineEventHandler(async (event) => {
  const parsed = analyticsQuerySchema.safeParse(getQuery(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid analytics query',
    })
  }

  return await getAnalyticsMetrics(event, parsed.data)
})

