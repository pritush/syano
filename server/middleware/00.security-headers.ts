import { defineEventHandler, setHeader, getRequestURL } from 'h3'

/**
 * Security Headers Middleware
 * 
 * Sets standard security headers on all responses to protect against
 * clickjacking, MIME sniffing, XSS, and other common web attacks.
 * 
 * Runs before all other middleware (file prefix "00." ensures lowest sort order).
 */
export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname

  // ── Core Security Headers ──────────────────────────────

  // Prevent MIME type sniffing
  setHeader(event, 'X-Content-Type-Options', 'nosniff')

  // Prevent clickjacking — allow framing only for cloaking pages
  // Cloaking pages need to iframe external sites, but the dashboard should never be framed
  if (!pathname.startsWith('/api/')) {
    setHeader(event, 'X-Frame-Options', 'SAMEORIGIN')
  }

  // Control referrer information leakage
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')

  // Restrict browser feature access
  setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // Force HTTPS (only in production)
  if (process.env.NODE_ENV === 'production') {
    setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  // Basic CSP — restrictive for dashboard, relaxed for redirect pages
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/')) {
    setHeader(
      event,
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "img-src 'self' data: https:",
        "font-src 'self' data: https://cdn.jsdelivr.net",
        "connect-src 'self' https://api.iconify.design https://cdn.jsdelivr.net",
        "worker-src 'self' blob:",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    )
  }
})
