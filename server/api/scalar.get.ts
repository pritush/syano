import { defineEventHandler, getQuery, setHeader } from 'h3'
import { verifyJWTToken } from '~/server/utils/auth'

/**
 * Serves a standalone Scalar API reference page.
 * Accepts ?token=JWT for authentication.
 * GET /api/scalar
 */

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = (query.token as string) || ''

  // Verify token if provided
  if (token) {
    const payload = await verifyJWTToken(token, event)
    if (!payload) {
      setHeader(event, 'content-type', 'text/html; charset=utf-8')
      return '<!DOCTYPE html><html><body><p style="font-family:system-ui;padding:2rem;color:#ef4444;">Invalid or expired token. Please log in again.</p></body></html>'
    }
  } else {
    setHeader(event, 'content-type', 'text/html; charset=utf-8')
    return '<!DOCTYPE html><html><body><p style="font-family:system-ui;padding:2rem;color:#ef4444;">Authentication required.</p></body></html>'
  }

  // Build the filtered OpenAPI spec URL with token for authentication
  const specUrl = `/api/openapi?token=${encodeURIComponent(token)}`

  // Scalar config with Bearer token pre-filled for "Try it" requests
  const scalarConfig = JSON.stringify({
    authentication: {
      preferredSecurityScheme: 'bearerAuth',
      http: {
        bearer: { token },
      },
    },
  }).replace(/"/g, '&quot;')

  setHeader(event, 'content-type', 'text/html; charset=utf-8')
  setHeader(event, 'cache-control', 'no-store')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SyanoLink API Reference</title>
  <style>
    body, html { margin: 0; padding: 0; height: 100%; }
  </style>
</head>
<body>
  <script
    id="api-reference"
    data-url="${specUrl}"
    data-configuration="${scalarConfig}"
  ></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`
})
