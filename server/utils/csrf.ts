import crypto from 'node:crypto'
import type { H3Event } from 'h3'
import { getCookie, setCookie, getHeader } from 'h3'

/**
 * CSRF protection using the double-submit cookie pattern.
 * 
 * - On GET: generates a random CSRF token, sets it as a cookie,
 *   and returns it for embedding in the form as a hidden field.
 * - On POST: validates that the token in the form body matches
 *   the token in the cookie.
 * 
 * This protects against cross-site form submission attacks.
 */

const CSRF_COOKIE_NAME = 'syano_csrf'
const CSRF_COOKIE_MAX_AGE = 600 // 10 minutes

/**
 * Generate and set a CSRF token cookie.
 * Returns the token value to embed in a hidden form field.
 */
export function generateCsrfToken(event: H3Event): string {
  const token = crypto.randomBytes(32).toString('hex')
  
  setCookie(event, CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_COOKIE_MAX_AGE,
    path: '/',
  })
  
  return token
}

/**
 * Validate a CSRF token from a POST request.
 * The token from the form body must match the token in the cookie.
 * Returns true if valid, false otherwise.
 */
export function validateCsrfToken(event: H3Event, formToken: string | undefined): boolean {
  if (!formToken) {
    return false
  }
  
  const cookieToken = getCookie(event, CSRF_COOKIE_NAME)
  if (!cookieToken) {
    return false
  }
  
  // Use timing-safe comparison to prevent timing attacks
  try {
    const a = Buffer.from(formToken, 'utf8')
    const b = Buffer.from(cookieToken, 'utf8')
    
    if (a.length !== b.length) {
      return false
    }
    
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}
