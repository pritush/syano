type DashboardRequestOptions<T> = Parameters<typeof $fetch<T>>[1]

export function useDashboardApi() {
  const { token, clearToken } = useAuthToken()

  async function request<T>(path: string, options: DashboardRequestOptions<T> = {}) {
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string> | undefined) || {}),
    }

    if (token.value) {
      headers.authorization = `Bearer ${token.value}`
    }

    try {
      return await $fetch<T>(path, {
        ...options,
        headers,
      })
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
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
