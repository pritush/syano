const USER_STORAGE_KEY = 'syano.auth-user'

export interface AuthUserInfo {
  id: string
  username: string
  displayName: string
  permissions: string[]
  isRoot: boolean
}

/**
 * Auth composable — httpOnly cookie-based authentication.
 * 
 * The JWT token is stored in an httpOnly cookie set by the server on login.
 * JavaScript cannot access the token directly (XSS-proof).
 * 
 * Only non-sensitive user metadata is stored in localStorage for UI rendering.
 * The `token` ref is kept for backward compatibility (e.g., API docs iframe)
 * but is populated from the login response and NOT persisted in localStorage.
 */
export function useAuthToken() {
  const token = useState<string>('syano-auth-token', () => '')
  const user = useState<AuthUserInfo | null>('syano-auth-user', () => null)
  const hydrated = useState<boolean>('syano-auth-token-hydrated', () => false)

  function hydrate() {
    if (import.meta.client && !hydrated.value) {
      const storedUser = window.localStorage.getItem(USER_STORAGE_KEY)
      user.value = storedUser ? JSON.parse(storedUser) : null
      // Token lives in httpOnly cookie — we can't read it from JS.
      // But if we have a stored user, we assume the cookie is still valid.
      // The server will reject expired cookies with 401.
      hydrated.value = true
    }
  }

  function setAuth(newToken: string, newUser: AuthUserInfo) {
    // Token is kept in memory only (for API docs iframe backward compat)
    token.value = newToken.trim()
    user.value = newUser

    if (import.meta.client) {
      // Only persist non-sensitive user info — NOT the token
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser))
    }
  }

  async function clearToken() {
    token.value = ''
    user.value = null

    if (import.meta.client) {
      window.localStorage.removeItem(USER_STORAGE_KEY)

      // Clear the httpOnly cookie via server endpoint
      try {
        await $fetch('/api/auth/logout', { method: 'POST' })
      } catch {
        // Best-effort — cookie will expire on its own
      }
    }
  }

  // Auto-hydrate on client side
  if (import.meta.client && !hydrated.value) {
    hydrate()
  }

  return {
    token,
    user,
    // Legacy compat — username derived from user object
    username: computed(() => user.value?.username || ''),
    isAuthenticated: computed(() => Boolean(user.value)),
    hydrate,
    setAuth,
    clearToken,
    // Legacy methods mapped for backwards compat
    setToken: (value: string) => {
      token.value = value.trim()
    },
    setUsername: (_value: string) => {
      // No-op — username now comes from user object
    },
  }
}

