import { defineEventHandler, getCookie, getHeader, getQuery, setHeader } from 'h3'
import { verifyJWTToken } from '~/server/utils/auth'
import { PERMISSIONS, hasAllPermissions } from '~/shared/permissions'

/**
 * Serves a standalone Scalar API reference page.
 * Accepts cookie auth_token, Authorization header, or ?token=JWT.
 * GET /api/scalar
 */

export default defineEventHandler(async (event) => {
  const cookieToken = getCookie(event, 'auth_token')
  const authHeader = getHeader(event, 'authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : ''
  const queryToken = (getQuery(event).token as string | undefined) || ''
  const token = cookieToken || bearerToken || queryToken

  if (!token) {
    setHeader(event, 'content-type', 'text/html; charset=utf-8')
    return '<!DOCTYPE html><html><body style="font-family:system-ui;background:#0f172a;color:#f87171;padding:2rem;"><p>Authentication required. Please log in to view API documentation.</p></body></html>'
  }

  const payload = await verifyJWTToken(token, event)
  if (!payload) {
    setHeader(event, 'content-type', 'text/html; charset=utf-8')
    return '<!DOCTYPE html><html><body style="font-family:system-ui;background:#0f172a;color:#f87171;padding:2rem;"><p>Invalid or expired session. Please log in again.</p></body></html>'
  }

  const hasAdminAccess = payload?.isRoot === true || (
    payload?.permissions
      ? hasAllPermissions(payload.permissions, [
          PERMISSIONS.USERS_MANAGE,
          PERMISSIONS.API_MANAGE,
          PERMISSIONS.DATA_MANAGE,
        ])
      : false
  )

  if (!hasAdminAccess) {
    setHeader(event, 'content-type', 'text/html; charset=utf-8')
    return '<!DOCTYPE html><html><body style="font-family:system-ui;background:#0f172a;color:#f87171;padding:2rem;"><p>Access restricted: Only administrators can access API documentation.</p></body></html>'
  }

  // Build the filtered OpenAPI spec URL with token for authentication
  const specUrl = `/api/openapi?token=${encodeURIComponent(token)}`

  // Scalar config with Bearer token pre-filled for "Try it" requests
  const scalarConfig = JSON.stringify({
    spec: {
      url: specUrl,
    },
    proxyUrl: '',
    theme: 'default',
    darkMode: true,
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
    body, html { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background: #0f172a; }
    #app { height: 100%; width: 100%; }
    .scalar-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-family: system-ui, -apple-system, sans-serif;
      color: #94a3b8;
      font-size: 0.95rem;
      gap: 0.75rem;
    }
    .spinner {
      width: 22px;
      height: 22px;
      border: 2px solid rgba(255,255,255,0.1);
      border-top-color: #14b8a6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="app">
    <div class="scalar-loading">
      <div class="spinner"></div>
      <span>Loading API Documentation...</span>
    </div>
  </div>

  <script
    id="api-reference"
    data-url="${specUrl}"
    data-configuration="${scalarConfig}"
  ></script>
  <script src="/vendor/scalar/scalar.standalone.js" onerror="this.onerror=null;this.src='https://cdn.jsdelivr.net/npm/@scalar/api-reference';"></script>
  <script>
    // Ensure Scalar mounts cleanly across environments
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        const appEl = document.getElementById('app');
        if (appEl && appEl.querySelector('.scalar-loading') && window.Scalar && typeof window.Scalar.createApiReference === 'function') {
          appEl.innerHTML = '';
          window.Scalar.createApiReference('#app', {
            url: "${specUrl}",
            proxyUrl: '',
            theme: 'default',
            darkMode: true,
            authentication: {
              preferredSecurityScheme: 'bearerAuth',
              http: {
                bearer: { token: "${token}" }
              }
            }
          });
        }
      }, 400);
    });
  </script>
</body>
</html>`
})
