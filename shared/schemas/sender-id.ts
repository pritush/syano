import { z } from 'zod'

/**
 * Sender ID must be exactly 6 uppercase letters (A-Z).
 * This matches the TRAI India SMS Header/Sender ID format.
 */
export const SENDER_ID_REGEX = /^[A-Z]{6}$/

export const createSenderIdSchema = z.object({
  name: z
    .string()
    .trim()
    .length(6, 'Sender ID must be exactly 6 characters')
    .regex(SENDER_ID_REGEX, 'Sender ID must be 6 uppercase letters (A-Z)')
    .transform((v) => v.toUpperCase()),
  description: z
    .string()
    .trim()
    .max(240)
    .nullish()
    .transform((v) => v || null),
  is_default: z.boolean().optional(),
})

export const updateSenderIdSchema = z.object({
  name: z
    .string()
    .trim()
    .length(6, 'Sender ID must be exactly 6 characters')
    .regex(SENDER_ID_REGEX, 'Sender ID must be 6 uppercase letters (A-Z)')
    .transform((v) => v.toUpperCase())
    .optional(),
  description: z
    .string()
    .trim()
    .max(240)
    .nullish()
    .transform((v) => v || null)
    .optional(),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
})

export type CreateSenderIdInput = z.infer<typeof createSenderIdSchema>
export type UpdateSenderIdInput = z.infer<typeof updateSenderIdSchema>
