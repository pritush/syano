<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'dashboard-auth',
})

useHead({
  title: 'Analytics | Syano Dashboard',
  meta: [
    { name: 'description', content: 'View detailed analytics for your links including clicks, locations, devices, and referrers.' }
  ],
})

type TagItem = {
  id: string
  name: string
  link_count: number
}

type Counters = {
  total_clicks: number
  clicks_last_24h: number
  clicks_last_7d: number
  unique_slugs: number
}

type ViewsResponse = {
  items: Array<{ day: string; views: number }>
}

type MetricsResponse = {
  devices: Array<{ label: string; views: number }>
  browsers: Array<{ label: string; views: number }>
  countries: Array<{ label: string; views: number }>
  operating_systems: Array<{ label: string; views: number }>
  languages: Array<{ label: string; views: number }>
  timezones: Array<{ label: string; views: number }>
  referrers: Array<{ label: string; views: number }>
}

type HeatmapResponse = {
  items: Array<{ day_of_week: number; hour: number; views: number }>
}

type EventsResponse = {
  items: Array<{
    id: string
    slug: string | null
    url: string | null
    country: string | null
    region: string | null
    city: string | null
    referer: string | null
    browser: string | null
    device_type: string | null
    created_at: string
  }>
}

type LocationsResponse = {
  items: Array<{
    country: string
    region: string
    city: string
    latitude: number | null
    longitude: number | null
    views: number
  }>
}

const route = useRoute()
const api = useDashboardApi()

const days = ref('30')
const slug = ref(typeof route.query.slug === 'string' ? route.query.slug : '')
const selectedTagId = ref('')
const loading = ref(true)
const errorMessage = ref('')
const qrModalOpen = ref(false)

const tags = ref<TagItem[]>([])
const counters = ref<Counters>({
  total_clicks: 0,
  clicks_last_24h: 0,
  clicks_last_7d: 0,
  unique_slugs: 0,
})
const qrScans = ref(0)
const views = ref<ViewsResponse['items']>([])
const metrics = ref<MetricsResponse>({
  devices: [],
  browsers: [],
  countries: [],
  operating_systems: [],
  languages: [],
  timezones: [],
  referrers: [],
})
const heatmap = ref<HeatmapResponse['items']>([])
const events = ref<EventsResponse['items']>([])
const locations = ref<LocationsResponse['items']>([])

const technologyTab = ref<'devices' | 'browsers' | 'operating_systems'>('devices')
const locationTab = ref<'countries' | 'cities' | 'regions'>('countries')
const slugContext = computed(() => slug.value.trim() ? ` /${slug.value.trim()}` : '')

const technologyTabs = [
  { key: 'devices' as const, label: 'Devices' },
  { key: 'browsers' as const, label: 'Browsers' },
  { key: 'operating_systems' as const, label: 'OS' },
]

const locationTabs = [
  { key: 'countries' as const, label: 'Countries' },
  { key: 'cities' as const, label: 'Cities' },
  { key: 'regions' as const, label: 'Regions' },
]

const technologyItems = computed(() => {
  if (technologyTab.value === 'devices') {
    return metrics.value.devices
  }
  if (technologyTab.value === 'browsers') {
    return metrics.value.browsers
  }
  return metrics.value.operating_systems
})

const technologyTotal = computed(() => {
  return Math.max(1, technologyItems.value.reduce((sum, item) => sum + item.views, 0))
})

function aggregateLocationBy(kind: 'country' | 'city' | 'region') {
  const bucket = new Map<string, number>()

  locations.value.forEach((item) => {
    const raw = kind === 'country' ? item.country : kind === 'city' ? item.city : item.region
    const key = raw && raw !== 'unknown' ? raw : 'Unknown'
    bucket.set(key, (bucket.get(key) || 0) + item.views)
  })

  return Array.from(bucket.entries())
    .map(([label, views]) => ({ label, views }))
    .sort((a, b) => b.views - a.views)
}

const locationTableItems = computed(() => {
  if (locationTab.value === 'countries') {
    return aggregateLocationBy('country')
  }
  if (locationTab.value === 'cities') {
    return aggregateLocationBy('city')
  }
  return aggregateLocationBy('region')
})

const locationTableTotal = computed(() => {
  return Math.max(1, locationTableItems.value.reduce((sum, item) => sum + item.views, 0))
})

const locationTableLabel = computed(() => {
  if (locationTab.value === 'countries') {
    return 'Country'
  }
  if (locationTab.value === 'cities') {
    return 'City'
  }
  return 'Region'
})

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function queryParams() {
  return {
    days: Number(days.value),
    slug: slug.value.trim() || undefined,
    tag_id: selectedTagId.value || undefined,
  }
}

async function loadTags() {
  const response = await api.request<{ items: TagItem[] }>('/api/tags/list')
  tags.value = response.items
}

async function loadAnalytics() {
  loading.value = true
  errorMessage.value = ''

  try {
    const query = queryParams()
    const [counterData, viewData, metricData, heatmapData, eventData, locationData, qrData] = await Promise.all([
      api.request<Counters>('/api/stats/counters', { query }),
      api.request<ViewsResponse>('/api/stats/views', { query }),
      api.request<MetricsResponse>('/api/stats/metrics', { query }),
      api.request<HeatmapResponse>('/api/stats/heatmap', { query }),
      api.request<EventsResponse>('/api/logs/events', { query: { ...query, limit: 12 } }),
      api.request<LocationsResponse>('/api/logs/locations', { query }),
      api.request<{ qr_scans: number }>('/api/stats/qr-scans', { query }),
    ])

    counters.value = counterData
    views.value = viewData.items
    metrics.value = metricData
    heatmap.value = heatmapData.items
    events.value = eventData.items
    locations.value = locationData.items
    qrScans.value = qrData.qr_scans
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Unable to load analytics.'
  } finally {
    loading.value = false
  }
}

watch([days, selectedTagId], () => {
  loadAnalytics()
})

watch(slug, () => {
  loadAnalytics()
})

watch(
  () => route.query.slug,
  (value) => {
    slug.value = typeof value === 'string' ? value : ''
  },
)

onMounted(async () => {
  await loadTags()
  await loadAnalytics()
})
</script>

<template>
  <div class="space-y-6">
    <UCard class="sy-surface relative z-20 rounded-[32px] border-0 !overflow-visible">
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-2">
            <p class="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Analytics{{ slugContext }}
            </p>
            <h1 class="text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
              Inspect traffic
            </h1>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              v-if="slug.trim()"
              color="neutral"
              variant="soft"
              title="View QR Code"
              @click="qrModalOpen = true"
            >
              <UIcon name="lucide:qr-code" class="h-4 w-4" />
              QR Code
            </UButton>
            <UButton :disabled="loading" @click="loadAnalytics">
              {{ loading ? 'Refreshing…' : 'Refresh analytics' }}
            </UButton>
          </div>
        </div>
      </template>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(220px,0.8fr)]">
        <UFormField label="Days">
          <SySelect
            v-model="days"
            :options="[
              { label: 'Last 7 days', value: '7' },
              { label: 'Last 30 days', value: '30' },
              { label: 'Last 90 days', value: '90' }
            ]"
            buttonClass="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition-colors hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-brand-600"
          />
        </UFormField>

        <UFormField label="Slug filter">
          <input
            v-model="slug"
            type="text"
            placeholder="Filter to a specific slug"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition-colors hover:border-brand-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-brand-600 dark:focus:border-brand-500/50"
          />
        </UFormField>

        <UFormField label="Tag filter">
          <SySelect
            v-model="selectedTagId"
            :options="[{ label: 'All tags', value: '' }, ...tags.map(t => ({ label: t.name, value: String(t.id) }))]"
            buttonClass="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition-colors hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-brand-600"
          />
        </UFormField>
      </div>

      <p v-if="errorMessage" class="mt-5 rounded-2xl bg-accent-50 px-4 py-3 text-sm font-medium text-accent-700">
        {{ errorMessage }}
      </p>
    </UCard>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <UCard class="sy-surface rounded-[24px] border-0">
        <div class="flex items-center gap-4">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400">
            <UIcon name="lucide:mouse-pointer-click" class="h-6 w-6" />
          </div>
          <div>
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400">Total clicks</p>
            <p class="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{{ counters.total_clicks }}</p>
          </div>
        </div>
      </UCard>

      <UCard class="sy-surface rounded-[24px] border-0">
        <div class="flex items-center gap-4">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400">
            <UIcon name="lucide:qr-code" class="h-6 w-6" />
          </div>
          <div>
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400">QR scans</p>
            <p class="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{{ qrScans }}</p>
          </div>
        </div>
      </UCard>

      <UCard class="sy-surface rounded-[24px] border-0">
        <div class="flex items-center gap-4">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400">
            <UIcon name="lucide:clock-3" class="h-6 w-6" />
          </div>
          <div>
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400">Last 24 hours</p>
            <p class="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{{ counters.clicks_last_24h }}</p>
          </div>
        </div>
      </UCard>

      <UCard class="sy-surface rounded-[24px] border-0">
        <div class="flex items-center gap-4">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
            <UIcon name="lucide:calendar-days" class="h-6 w-6" />
          </div>
          <div>
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400">Last 7 days</p>
            <p class="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{{ counters.clicks_last_7d }}</p>
          </div>
        </div>
      </UCard>
    </div>

    <div class="grid gap-6 2xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
      <UCard class="sy-surface rounded-[28px] border-0">
        <template #header>
          <div>
            <h2 class="text-2xl font-semibold text-slate-950 dark:text-slate-100">
              Daily views
            </h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Rolling trend for the selected range.
            </p>
          </div>
        </template>

        <ClientOnly>
          <LazyDashboardAnalyticsLineChart :items="views" />
          <template #fallback>
            <LazyDashboardAnalyticsTrendChart :items="views" />
          </template>
        </ClientOnly>
      </UCard>

      <UCard class="sy-surface rounded-[28px] border-0">
        <template #header>
          <div>
            <h2 class="text-2xl font-semibold text-slate-950 dark:text-slate-100">
              Activity heatmap
            </h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Hour-of-day intensity by weekday.
            </p>
          </div>
        </template>

        <DashboardAnalyticsHeatmap :items="heatmap" />
      </UCard>
    </div>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <UCard class="sy-surface rounded-[28px] border-0">
        <template #header>
          <div class="space-y-3">
            <h2 class="text-2xl font-semibold text-slate-950 dark:text-slate-100">
              Technology
            </h2>
            <div class="inline-flex rounded-full border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
              <button
                v-for="tab in technologyTabs"
                :key="tab.key"
                type="button"
                class="rounded-full px-4 py-1.5 text-sm font-semibold transition"
                :class="technologyTab === tab.key ? 'bg-slate-900 text-white dark:bg-brand-500 dark:text-slate-900' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'"
                @click="technologyTab = tab.key"
              >
                {{ tab.label }}
              </button>
            </div>
          </div>
        </template>

        <div v-if="technologyItems.length" class="space-y-4">
          <div
            v-for="item in technologyItems"
            :key="item.label"
            class="rounded-2xl border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-800/70"
          >
            <div class="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <span class="truncate">{{ item.label }}</span>
              <span>{{ item.views }}</span>
            </div>
            <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                class="h-2 rounded-full bg-brand-500"
                :style="{ width: `${Math.max(8, (item.views / technologyTotal) * 100)}%` }"
              />
            </div>
          </div>
        </div>

        <div v-else class="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          No breakdown data yet.
        </div>
      </UCard>

      <UCard class="sy-surface rounded-[28px] border-0">
        <template #header>
          <div class="space-y-3">
            <h2 class="text-2xl font-semibold text-slate-950 dark:text-slate-100">
              Locations
            </h2>
            <div class="inline-flex rounded-full border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
              <button
                v-for="tab in locationTabs"
                :key="tab.key"
                type="button"
                class="rounded-full px-4 py-1.5 text-sm font-semibold transition"
                :class="locationTab === tab.key ? 'bg-slate-900 text-white dark:bg-brand-500 dark:text-slate-900' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'"
                @click="locationTab = tab.key"
              >
                {{ tab.label }}
              </button>
            </div>
          </div>
        </template>

        <div v-if="locationTableItems.length" class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <div class="grid grid-cols-[56px_minmax(0,1fr)_130px_80px] bg-slate-50 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <span>#</span>
            <span>{{ locationTableLabel }}</span>
            <span class="text-right">Engagements</span>
            <span class="text-right">%</span>
          </div>

          <div class="max-h-[360px] overflow-y-auto">
            <div
              v-for="(item, index) in locationTableItems"
              :key="`${locationTab}-${item.label}`"
              class="grid grid-cols-[56px_minmax(0,1fr)_130px_80px] border-t border-slate-100 px-4 py-2.5 text-sm dark:border-slate-800"
            >
              <span class="font-semibold text-slate-500 dark:text-slate-400">{{ index + 1 }}</span>
              <span class="truncate font-medium text-slate-800 dark:text-slate-100">{{ item.label }}</span>
              <span class="text-right font-semibold text-slate-700 dark:text-slate-200">{{ item.views }}</span>
              <span class="text-right text-slate-500 dark:text-slate-400">{{ Math.round((item.views / locationTableTotal) * 100) }}%</span>
            </div>
          </div>
        </div>

        <div v-else class="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          No location aggregates available yet.
        </div>
      </UCard>
    </div>

    <UCard class="sy-surface rounded-[28px] border-0">
      <template #header>
        <div>
          <h2 class="text-2xl font-semibold text-slate-950 dark:text-slate-100">
            Global reach map
          </h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Marker intensity scales with the number of tracked clicks per location.
          </p>
        </div>
      </template>

      <ClientOnly>
        <LazyDashboardAnalyticsWorldMap :items="locations" />
        <template #fallback>
          <div class="flex h-[450px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
            Loading map...
          </div>
        </template>
      </ClientOnly>
    </UCard>
  </div>

  <!-- QR Code Modal -->
  <DashboardQRCodeViewer
    v-if="slug.trim()"
    v-model="qrModalOpen"
    :slug="slug.trim()"
  />
</template>
