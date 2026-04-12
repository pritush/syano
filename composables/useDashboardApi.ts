type DashboardRequestOptions<T> = Parameters<typeof $fetch<T>>[1]

export function useDashboardApi() {
  const { token, username, hydrate, clearToken } = useAuthToken()

  async function request<T>(path: string, options: DashboardRequestOptions<T> = {}) {
    hydrate()

    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string> | undefined) || {}),
    }

    if (token.value) {
      headers.authorization = `Bearer ${token.value}`
    }

    if (username.value) {
      headers['x-site-user'] = username.value
    }

    try {
      return await $fetch<T>(path, {
        ...options,
        headers,
      })
    } catch (error: any) {
      if (error?.response?.status === 401) {
        clearToken()

        if (import.meta.client) {
          await navigateTo('/dashboard/login')
        }
      }

      throw error
    }
  }

  return {
    request,
  }
}

