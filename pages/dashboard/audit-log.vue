<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Audit Log — Syano' })

const { request } = useDashboardApi()
const toasts = useToasts()

interface AuditRow {
  id: string
  actor_id: string
  actor_username: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_label: string | null
  details: Record<string, unknown> | null
  ip: string | null
  created_at: string
}

const items = ref<AuditRow[]>([])
const total = ref(0)
const loading = ref(true)
const page = ref(1)
const perPage = 30

// Filters
const filterAction = ref('')
const filterEntity = ref('')
const searchQuery = ref('')
const dateFrom = ref('')
const dateTo = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / perPage)))

async function fetchLogs() {
  loading.value = true
  try {
    const params: Record<string, string | number> = {
      limit: perPage,
      offset: (page.value - 1) * perPage,
    }
    if (filterAction.value) params.action = filterAction.value
    if (filterEntity.value) params.entity_type = filterEntity.value
    if (searchQuery.value) params.search = searchQuery.value
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value

    const query = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) query.set(k, String(v))

    const data = await request<{ items: AuditRow[]; total: number }>(`/api/audit-logs/list?${query}`)
    items.value = data.items
    total.value = data.total
  } catch (err: any) {
    toasts.error('Failed to load audit logs', err?.data?.statusMessage || 'Unknown error')
  } finally {
    loading.value = false
  }
}

onMounted(fetchLogs)

watch([filterAction, filterEntity, dateFrom, dateTo], () => {
  page.value = 1
  fetchLogs()
})

let searchDebounce: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    page.value = 1
    fetchLogs()
  }, 350)
})

function nextPage() {
  if (page.value < totalPages.value) {
    page.value++
    fetchLogs()
  }
}

function prevPage() {
  if (page.value > 1) {
    page.value--
    fetchLogs()
  }
}

function clearFilters() {
  filterAction.value = ''
  filterEntity.value = ''
  searchQuery.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  page.value = 1
  fetchLogs()
}

const hasFilters = computed(() =>
  filterAction.value || filterEntity.value || searchQuery.value || dateFrom.value || dateTo.value
)

async function exportLogs(format: 'json' | 'csv') {
  try {
    const params = new URLSearchParams({ format })
    if (dateFrom.value) params.set('date_from', dateFrom.value)
    if (dateTo.value) params.set('date_to', dateTo.value)

    const data = await request<any>(`/api/audit-logs/export?${params}`)

    let blob: Blob
    let ext: string
    if (format === 'csv') {
      blob = new Blob([data as string], { type: 'text/csv' })
      ext = 'csv'
    } else {
      blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      ext = 'json'
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
    toasts.success('Export ready', `Audit log exported as ${ext.toUpperCase()}`)
  } catch (err: any) {
    toasts.error('Export failed', err?.data?.statusMessage || 'Unknown error')
  }
}

// Visual helpers
const actionConfig: Record<string, { icon: string; color: string; label: string }> = {
  create: { icon: 'lucide:plus-circle', color: 'text-emerald-600 dark:text-emerald-400', label: 'Created' },
  update: { icon: 'lucide:pencil', color: 'text-amber-600 dark:text-amber-400', label: 'Updated' },
  delete: { icon: 'lucide:trash-2', color: 'text-red-500 dark:text-red-400', label: 'Deleted' },
}

const entityConfig: Record<string, { icon: string; label: string }> = {
  link: { icon: 'lucide:link-2', label: 'Link' },
  tag: { icon: 'lucide:tag', label: 'Tag' },
  user: { icon: 'lucide:user', label: 'User' },
  settings: { icon: 'lucide:settings-2', label: 'Settings' },
}

function getAction(a: string) { return actionConfig[a] || { icon: 'lucide:circle', color: 'text-slate-400', label: a } }
function getEntity(e: string) { return entityConfig[e] || { icon: 'lucide:box', label: e } }

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function relativeTime(d: string) {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return ''
  return Object.entries(details)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join(' · ')
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-slate-950 dark:text-slate-50">Audit Log</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Immutable record of every action. Exportable for compliance and security reviews.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton color="neutral" variant="soft" size="md" icon="lucide:download" @click="exportLogs('csv')">
          CSV
        </UButton>
        <UButton color="neutral" variant="soft" size="md" icon="lucide:download" @click="exportLogs('json')">
          JSON
        </UButton>
      </div>
    </div>

    <!-- Filters -->
    <div class="sy-audit-filters">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <UInput
          v-model="searchQuery"
          size="md"
          placeholder="Search actor, entity..."
          icon="lucide:search"
          class="w-full"
        />
        <select v-model="filterAction" class="sy-audit-select">
          <option value="">All Actions</option>
          <option value="create">Created</option>
          <option value="update">Updated</option>
          <option value="delete">Deleted</option>
        </select>
        <select v-model="filterEntity" class="sy-audit-select">
          <option value="">All Entities</option>
          <option value="link">Link</option>
          <option value="tag">Tag</option>
          <option value="user">User</option>
          <option value="settings">Settings</option>
        </select>
        <input v-model="dateFrom" type="date" class="sy-audit-select" placeholder="From" />
        <input v-model="dateTo" type="date" class="sy-audit-select" placeholder="To" />
      </div>
      <div v-if="hasFilters" class="mt-3 flex items-center gap-2">
        <span class="text-xs text-slate-400 dark:text-slate-500">{{ total }} result{{ total === 1 ? '' : 's' }}</span>
        <button type="button" class="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400" @click="clearFilters">
          Clear all filters
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <UIcon name="lucide:loader-2" class="h-8 w-8 animate-spin text-brand-500" />
    </div>

    <!-- Empty -->
    <div v-else-if="items.length === 0" class="sy-dashboard-card flex flex-col items-center justify-center gap-4 py-20">
      <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-950/40">
        <UIcon name="lucide:scroll-text" class="h-8 w-8 text-brand-500" />
      </div>
      <div class="text-center">
        <p class="text-lg font-semibold text-slate-900 dark:text-slate-100">No audit entries</p>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ hasFilters ? 'No entries match your filters. Try adjusting them.' : 'Actions will appear here once users start creating, editing, or deleting resources.' }}
        </p>
      </div>
    </div>

    <!-- Log Entries - Table View -->
    <div v-else class="sy-dashboard-card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="border-b border-slate-200 dark:border-slate-700">
            <tr class="text-left text-xs font-medium text-slate-500 dark:text-slate-400">
              <th class="px-4 py-3 font-semibold">Action</th>
              <th class="px-4 py-3 font-semibold">Actor</th>
              <th class="px-4 py-3 font-semibold">Entity</th>
              <th class="px-4 py-3 font-semibold">Label</th>
              <th class="px-4 py-3 font-semibold">Details</th>
              <th class="px-4 py-3 font-semibold">IP</th>
              <th class="px-4 py-3 font-semibold">Time</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr
              v-for="item in items"
              :key="item.id"
              class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <!-- Action -->
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="flex items-center gap-2">
                  <UIcon
                    :name="getAction(item.action).icon"
                    class="h-4 w-4"
                    :class="getAction(item.action).color"
                  />
                  <span class="text-sm font-medium" :class="getAction(item.action).color">
                    {{ getAction(item.action).label }}
                  </span>
                </div>
              </td>

              <!-- Actor -->
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {{ item.actor_username }}
                </span>
              </td>

              <!-- Entity Type -->
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                  <UIcon :name="getEntity(item.entity_type).icon" class="h-3.5 w-3.5" />
                  {{ getEntity(item.entity_type).label }}
                </div>
              </td>

              <!-- Entity Label -->
              <td class="px-4 py-3 max-w-xs">
                <span
                  v-if="item.entity_label"
                  class="text-sm text-slate-700 dark:text-slate-300 truncate block"
                  :title="item.entity_label"
                >
                  {{ item.entity_label }}
                </span>
                <span v-else class="text-sm text-slate-400 dark:text-slate-600">—</span>
              </td>

              <!-- Details -->
              <td class="px-4 py-3 max-w-sm">
                <span
                  v-if="item.details"
                  class="text-xs text-slate-500 dark:text-slate-500 truncate block"
                  :title="formatDetails(item.details)"
                >
                  {{ formatDetails(item.details) }}
                </span>
                <span v-else class="text-xs text-slate-400 dark:text-slate-600">—</span>
              </td>

              <!-- IP -->
              <td class="px-4 py-3 whitespace-nowrap">
                <span v-if="item.ip" class="text-xs font-mono text-slate-500 dark:text-slate-500">
                  {{ item.ip }}
                </span>
                <span v-else class="text-xs text-slate-400 dark:text-slate-600">—</span>
              </td>

              <!-- Time -->
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="flex flex-col gap-0.5">
                  <span class="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {{ relativeTime(item.created_at) }}
                  </span>
                  <span class="text-xs text-slate-400 dark:text-slate-600" :title="formatDate(item.created_at)">
                    {{ new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="!loading && items.length > 0" class="flex items-center justify-between pt-2">
      <span class="text-sm text-slate-500 dark:text-slate-400">
        Showing {{ (page - 1) * perPage + 1 }}–{{ Math.min(page * perPage, total) }} of {{ total }}
      </span>
      <div class="flex items-center gap-2">
        <UButton color="neutral" variant="soft" size="sm" icon="lucide:chevron-left" :disabled="page <= 1" @click="prevPage" />
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{{ page }} / {{ totalPages }}</span>
        <UButton color="neutral" variant="soft" size="sm" icon="lucide:chevron-right" :disabled="page >= totalPages" @click="nextPage" />
      </div>
    </div>
  </div>
</template>
