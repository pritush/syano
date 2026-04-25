const AUTH_STORAGE_KEY = 'syano.auth-token'
const USER_STORAGE_KEY = 'syano.auth-user'

export interface AuthUserInfo {
  id: string
  username: string
  displayName: string
  permissions: string[]
  isRoot: boolean
}

export function useAuthToken() {
  const token = useState<string>('syano-auth-token', () => '')
  const user = useState<AuthUserInfo | null>('syano-auth-user', () => null)
  const hydrated = useState<boolean>('syano-auth-token-hydrated', () => false)

  function hydrate() {
    if (import.meta.client && !hydrated.value) {
      const storedToken = window.localStorage.getItem(AUTH_STORAGE_KEY) || ''
      const storedUser = window.localStorage.getItem(USER_STORAGE_KEY)

      token.value = storedToken
      user.value = storedUser ? JSON.parse(storedUser) : null
      hydrated.value = true
    }
  }

  function setAuth(newToken: string, newUser: AuthUserInfo) {
    token.value = newToken.trim()
    user.value = newUser

    if (import.meta.client) {
      if (token.value) {
        window.localStorage.setItem(AUTH_STORAGE_KEY, token.value)
        window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser))
      } else {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
        window.localStorage.removeItem(USER_STORAGE_KEY)
      }
    }
  }

  function clearToken() {
    token.value = ''
    user.value = null

    if (import.meta.client) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      window.localStorage.removeItem(USER_STORAGE_KEY)
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
    isAuthenticated: computed(() => Boolean(token.value && user.value)),
    hydrate,
    setAuth,
    clearToken,
    // Legacy methods mapped for backwards compat
    setToken: (value: string) => {
      token.value = value.trim()
      if (import.meta.client) {
        if (value.trim()) {
          window.localStorage.setItem(AUTH_STORAGE_KEY, value.trim())
        } else {
          window.localStorage.removeItem(AUTH_STORAGE_KEY)
        }
      }
    },
    setUsername: (_value: string) => {
      // No-op — username now comes from user object
    },
  }
}
