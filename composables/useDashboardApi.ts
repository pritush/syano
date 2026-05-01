type DashboardRequestOptions<T> = Parameters<typeof $fetch<T>>[1]

/**
 * Dashboard API client with JWT authentication
 * Supports both legacy endpoints and V1 API endpoints
 */
export function useDashboardApi() {
  const { token, clearToken } = useAuthToken()

  /**
   * Make an authenticated API request
   * Automatically adds JWT Bearer token to headers
   */
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

  /**
   * V1 API Helper: List links with pagination and filtering
   */
  async function listLinks(params?: {
    limit?: number
    offset?: number
    search?: string
    tag_id?: string
  }) {
    return request<{
      success: boolean
      data: Array<{
        id: string
        slug: string
        url: string
        short_url: string
        title: string | null
        description: string | null
        comment: string | null
        tag_id: string | null
        expiration: string | null
        cloaking: boolean
        redirect_with_query: boolean
        created_at: string
        updated_at: string
        click_count: number
      }>
      pagination: {
        limit: number
        offset: number
        total: number
        has_more: boolean
      }
    }>('/api/v1/links', {
      query: params,
    })
  }

  /**
   * V1 API Helper: Create a new link
   */
  async function createLink(data: {
    url: string
    slug?: string
    title?: string
    description?: string
    comment?: string
    tag_id?: string
    expiration?: number
    password?: string
    cloaking?: boolean
    redirect_with_query?: boolean
  }) {
    return request<{
      success: boolean
      data: {
        id: string
        slug: string
        url: string
        short_url: string
        title: string | null
        description: string | null
        comment: string | null
        tag_id: string | null
        expiration: string | null
        cloaking: boolean
        redirect_with_query: boolean
        created_at: string
        updated_at: string
      }
    }>('/api/v1/links', {
      method: 'POST',
      body: data,
    })
  }

  /**
   * V1 API Helper: Get a specific link
   */
  async function getLink(slug: string) {
    return request<{
      success: boolean
      data: {
        id: string
        slug: string
        url: string
        short_url: string
        title: string | null
        description: string | null
        comment: string | null
        tag_id: string | null
        expiration: string | null
        cloaking: boolean
        redirect_with_query: boolean
        created_at: string
        updated_at: string
      }
    }>(`/api/v1/links/${slug}`)
  }

  /**
   * V1 API Helper: Update a link
   */
  async function updateLink(slug: string, data: {
    url?: string
    title?: string
    description?: string
    comment?: string
    tag_id?: string | null
    expiration?: number | null
    password?: string | null
    cloaking?: boolean
    redirect_with_query?: boolean
  }) {
    return request<{
      success: boolean
      data: {
        id: string
        slug: string
        url: string
        short_url: string
        title: string | null
        description: string | null
        comment: string | null
        tag_id: string | null
        expiration: string | null
        cloaking: boolean
        redirect_with_query: boolean
        created_at: string
        updated_at: string
      }
    }>(`/api/v1/links/${slug}`, {
      method: 'PATCH',
      body: data,
    })
  }

  /**
   * V1 API Helper: Delete a link
   */
  async function deleteLink(slug: string) {
    return request<{
      success: boolean
      message: string
    }>(`/api/v1/links/${slug}`, {
      method: 'DELETE',
    })
  }

  /**
   * V1 API Helper: List tags
   */
  async function listTags(params?: { search?: string }) {
    return request<{
      success: boolean
      data: Array<{
        id: string
        name: string
        color: string
        created_at: string
        link_count: number
      }>
    }>('/api/v1/tags', {
      query: params,
    })
  }

  /**
   * V1 API Helper: Create a tag
   */
  async function createTag(data: { name: string; color?: string }) {
    return request<{
      success: boolean
      data: {
        id: string
        name: string
        color: string
        created_at: string
      }
    }>('/api/v1/tags', {
      method: 'POST',
      body: data,
    })
  }

  /**
   * V1 API Helper: Delete a tag
   */
  async function deleteTag(id: string) {
    return request<{
      success: boolean
      message: string
    }>(`/api/v1/tags/${id}`, {
      method: 'DELETE',
    })
  }

  /**
   * V1 API Helper: Get analytics for a link
   */
  async function getAnalytics(slug: string, params?: {
    start_date?: string
    end_date?: string
  }) {
    return request<{
      success: boolean
      data: {
        link: {
          id: string
          slug: string
          url: string
          title: string | null
          created_at: string
        }
        period: {
          start_date: string
          end_date: string
        }
        summary: {
          total_clicks: number
        }
        clicks_by_date: Array<{ date: string; clicks: number }>
        clicks_by_country: Array<{ country: string | null; clicks: number }>
        clicks_by_device: Array<{ device: string | null; clicks: number }>
        clicks_by_browser: Array<{ browser: string | null; clicks: number }>
        recent_clicks: Array<{
          id: string
          country: string | null
          city: string | null
          device_type: string | null
          browser: string | null
          os: string | null
          scanned_at: string
        }>
      }
    }>(`/api/v1/analytics/${slug}`, {
      query: params,
    })
  }

  /**
   * V1 API Helper: Export all links
   */
  async function exportLinks() {
    return request<{
      success: boolean
      data: {
        exported_at: string
        count: number
        items: any[]
      }
    }>('/api/v1/links/export')
  }

  /**
   * V1 API Helper: Import links
   */
  async function importLinks(data: {
    items: any[]
    overwrite: boolean
  }) {
    return request<{
      success: boolean
      data: {
        count: number
        items: any[]
      }
    }>('/api/v1/links/import', {
      method: 'POST',
      body: data,
    })
  }

  /**
   * V1 API Helper: Search links
   */
  async function searchLinks(params: {
    q: string
    limit?: number
  }) {
    return request<{
      success: boolean
      data: Array<{
        slug: string
        url: string
        comment: string | null
      }>
    }>('/api/v1/links/search', {
      query: params,
    })
  }

  /**
   * V1 API Helper: Get analytics counters
   */
  async function getAnalyticsCounters(params?: {
    start_date?: string
    end_date?: string
    slug?: string
    tag_id?: string
  }) {
    return request<{
      success: boolean
      data: any
    }>('/api/v1/analytics/counters', {
      query: params,
    })
  }

  /**
   * V1 API Helper: Get analytics views
   */
  async function getAnalyticsViews(params?: {
    start_date?: string
    end_date?: string
    slug?: string
    tag_id?: string
  }) {
    return request<{
      success: boolean
      data: any[]
    }>('/api/v1/analytics/views', {
      query: params,
    })
  }

  /**
   * V1 API Helper: Get analytics metrics
   */
  async function getAnalyticsMetrics(params?: {
    start_date?: string
    end_date?: string
    slug?: string
    tag_id?: string
  }) {
    return request<{
      success: boolean
      data: any
    }>('/api/v1/analytics/metrics', {
      query: params,
    })
  }

  /**
   * V1 API Helper: Get analytics heatmap
   */
  async function getAnalyticsHeatmap(params?: {
    start_date?: string
    end_date?: string
    slug?: string
    tag_id?: string
  }) {
    return request<{
      success: boolean
      data: any[]
    }>('/api/v1/analytics/heatmap', {
      query: params,
    })
  }

  /**
   * V1 API Helper: Get analytics events
   */
  async function getAnalyticsEvents(params?: {
    start_date?: string
    end_date?: string
    slug?: string
    tag_id?: string
    limit?: number
  }) {
    return request<{
      success: boolean
      data: any[]
    }>('/api/v1/analytics/events', {
      query: params,
    })
  }

  /**
   * V1 API Helper: Get analytics locations
   */
  async function getAnalyticsLocations(params?: {
    start_date?: string
    end_date?: string
    slug?: string
    tag_id?: string
  }) {
    return request<{
      success: boolean
      data: any[]
    }>('/api/v1/analytics/locations', {
      query: params,
    })
  }

  /**
   * V1 API Helper: Get QR scans count
   */
  async function getQrScans(params?: {
    start_date?: string
    end_date?: string
    slug?: string
    tag_id?: string
  }) {
    return request<{
      success: boolean
      data: { qr_scans: number }
    }>('/api/v1/analytics/qr-scans', {
      query: params,
    })
  }

  return {
    request,
    // V1 API helpers
    listLinks,
    createLink,
    getLink,
    updateLink,
    deleteLink,
    listTags,
    createTag,
    deleteTag,
    getAnalytics,
    exportLinks,
    importLinks,
    searchLinks,
    // Analytics helpers
    getAnalyticsCounters,
    getAnalyticsViews,
    getAnalyticsMetrics,
    getAnalyticsHeatmap,
    getAnalyticsEvents,
    getAnalyticsLocations,
    getQrScans,
  }
}
