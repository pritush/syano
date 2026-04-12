const AUTH_STORAGE_KEY = 'syano.site-token'
const USER_STORAGE_KEY = 'syano.site-user'

export function useAuthToken() {
  const token = useState<string>('syano-auth-token', () => '')
  const username = useState<string>('syano-auth-username', () => '')
  const hydrated = useState<boolean>('syano-auth-token-hydrated', () => false)

  function hydrate() {
    if (import.meta.client && !hydrated.value) {
      // Batch localStorage reads for better performance
      const storedToken = window.localStorage.getItem(AUTH_STORAGE_KEY) || ''
      const storedUser = window.localStorage.getItem(USER_STORAGE_KEY) || ''
      
      token.value = storedToken
      username.value = storedUser
      hydrated.value = true
    }
  }

  function setToken(value: string) {
    const nextValue = value.trim()
    token.value = nextValue

    if (import.meta.client) {
      if (nextValue) {
        window.localStorage.setItem(AUTH_STORAGE_KEY, nextValue)
      } else {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
      }
    }
  }

  function setUsername(value: string) {
    const nextValue = value.trim()
    username.value = nextValue

    if (import.meta.client) {
      if (nextValue) {
        window.localStorage.setItem(USER_STORAGE_KEY, nextValue)
      } else {
        window.localStorage.removeItem(USER_STORAGE_KEY)
      }
    }
  }

  function clearToken() {
    token.value = ''
    username.value = ''
    
    if (import.meta.client) {
      // Batch localStorage operations
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
    username,
    isAuthenticated: computed(() => Boolean(token.value && username.value)),
    hydrate,
    setToken,
    setUsername,
    clearToken,
  }
}

