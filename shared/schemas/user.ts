import { z } from 'zod'
import { ALL_PERMISSIONS } from '~/shared/permissions'

const validPermissionKeys = ALL_PERMISSIONS.map(p => p.key)

/** Schema for creating a new user */
export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(64, 'Username must be at most 64 characters')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dots, hyphens, and underscores'),
  displayName: z
    .string()
    .max(120, 'Display name must be at most 120 characters')
    .optional()
    .default(''),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be at most 128 characters'),
  permissions: z
    .array(z.string().refine(val => validPermissionKeys.includes(val as any), {
      message: 'Invalid permission key',
    }))
    .default([]),
})

/** Schema for updating an existing user */
export const updateUserSchema = z.object({
  displayName: z
    .string()
    .max(120, 'Display name must be at most 120 characters')
    .optional(),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be at most 128 characters')
    .optional(),
  permissions: z
    .array(z.string().refine(val => validPermissionKeys.includes(val as any), {
      message: 'Invalid permission key',
    }))
    .optional(),
  isActive: z.boolean().optional(),
})

/** Schema for login request */
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type LoginInput = z.infer<typeof loginSchema>
