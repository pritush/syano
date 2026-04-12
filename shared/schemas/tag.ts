import { z } from 'zod'

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(120),
})

export const deleteTagSchema = z.object({
  id: z.string().trim().min(1).max(64),
})

export type TagRecord = {
  id: string
  name: string
  created_at: string | Date
}
