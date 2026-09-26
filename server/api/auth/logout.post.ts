import { defineEventHandler, setCookie } from 'h3'

/**
 * Logout endpoint — clears the httpOnly auth cookie.
 * POST /api/auth/logout
 */
export default defineEventHandler((event) => {
  // Clear the httpOnly auth cookie
  setCookie(event, 'auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0, // Expire immediately
    path: '/',
  })

  return { success: true }
})
