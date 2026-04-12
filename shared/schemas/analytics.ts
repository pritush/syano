import { z } from 'zod'

export const analyticsQuerySchema = z.object({
  slug: z.string().trim().min(1).max(128).optional(),
  tag_id: z.string().trim().min(1).max(64).optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(250).default(50),
})

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>
