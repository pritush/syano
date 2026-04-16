<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'dashboard-auth',
})

useHead({
  title: 'Links | Syano Dashboard',
  meta: [
    { name: 'description', content: 'Manage your shortened links, view analytics, and organize with tags.' }
  ],
})

const route = useRoute()
const api = useDashboardApi()
const toasts = useToasts()

type LinkRecord = {
  id: string
  slug: string
  url: string
  comment: string | null
  title: string | null
  description: string | null
  image: string | null
  apple: string | null
  google: string | null
  cloaking: boolean
  redirect_with_query: boolean
  password: string | null
  unsafe: boolean
  tag_id: string | null
  expiration: number | string | Date | null
  created_at: string | Date | null
  updated_at: string | Date | null
  click_count: number
}

type TagItem = {
  id: string
  name: string
  link_count: number
}


type SortMode = 'recent' | 'slug' | 'clicks'

const links = ref<LinkRecord[]>([])
const tags = ref<TagItem[]>([])
const loading = ref(true)
const deletingSlug = ref<string | null>(null)
const copiedSlug = ref<string | null>(null)
const qrModalSlug = ref<string | null>(null)
const qrModalOpen = ref(false)
const errorMessage = ref('')
const statusMessage = ref('')
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const selectedTagId = ref('')
const sortBy = ref<SortMode>('recent')
const page = ref(1)
const pageSize = 8
const deleteModalOpen = ref(false)
const pendingDeleteSlug = ref<string | null>(null)

async function clearQuerySearch() {
  search.value = ''

  const query = {
    ...route.query,
  }

  delete query.q

  await navigateTo({
    path: route.path,
    query,
  }, { replace: true })
}

async function copyShortLink(slug: string) {
  if (!import.meta.client) {
    return
  }

  try {
    await navigator.clipboard.writeText(`${window.location.origin}/${slug}`)
    copiedSlug.value = slug
    
    toasts.copied(`/${slug}`)

    window.setTimeout(() => {
      if (copiedSlug.value === slug) {
        copiedSlug.value = null
      }
    }, 2000)
  } catch (error) {
    toasts.error('Copy failed', 'Unable to copy link to clipboard')
  }
}

function formatDate(value: number | string | Date | null | undefined) {
  if (!value) {
    return 'Not set'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Not set'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function openEditPage(slug: string) {
  navigateTo(`/dashboard/links/${slug}/edit`)
}

function openLinkAnalytics(slug: string) {
  navigateTo(`/dashboard/analytics?slug=${slug}`)
}

function openQRModal(slug: string) {
  qrModalSlug.value = slug
  qrModalOpen.value = true
}

function closeQRModal() {
  qrModalOpen.value = false
  qrModalSlug.value = null
}

const tagMap = computed<Record<string, TagItem>>(() => {
  return Object.fromEntries(tags.value.map((tag) => [tag.id, tag]))
})

const filteredLinks = computed(() => {
  const q = search.value.trim().toLowerCase()

  if (!q) {
    return links.value
  }

  return links.value.filter((link) =>
    [link.slug, link.url, link.comment, link.title, link.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q)),
  )
})

const sortedLinks = computed(() => {
  const items = [...filteredLinks.value]

  if (sortBy.value === 'slug') {
    items.sort((a, b) => a.slug.localeCompare(b.slug))
    return items
  }

  if (sortBy.value === 'clicks') {
    items.sort((a, b) => b.click_count - a.click_count)
    return items
  }

  items.sort((a, b) => {
    const aValue = new Date(a.created_at || 0).getTime()
    const bValue = new Date(b.created_at || 0).getTime()
    return bValue - aValue
  })

  return items
})

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(sortedLinks.value.length / pageSize))
})

const pagedLinks = computed(() => {
  const start = (page.value - 1) * pageSize
  return sortedLinks.value.slice(start, start + pageSize)
})

const rangeStart = computed(() => {
  if (!sortedLinks.value.length) {
    return 0
  }

  return (page.value - 1) * pageSize + 1
})

const rangeEnd = computed(() => {
  if (!sortedLinks.value.length) {
    return 0
  }

  return Math.min(page.value * pageSize, sortedLinks.value.length)
})

function goToPage(nextPage: number) {
  page.value = Math.min(totalPages.value, Math.max(1, nextPage))
}

async function loadLinks() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.request<{ items: LinkRecord[] }>('/api/link/list', {
      query: {
        limit: 100,
        tag_id: selectedTagId.value || undefined,
      },
    })

    links.value = response.items
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Unable to load links.'
  } finally {
    loading.value = false
  }
}

async function loadTags() {
  try {
    const response = await api.request<{ items: TagItem[] }>('/api/tags/list')
    tags.value = response.items
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Unable to load tags.'
  }
}



function requestRemoveLink(slug: string) {
  pendingDeleteSlug.value = slug
  deleteModalOpen.value = true
}

function closeDeleteModal() {
  if (deletingSlug.value) {
    return
  }

  deleteModalOpen.value = false
  pendingDeleteSlug.value = null
}

async function confirmRemoveLink() {
  const slug = pendingDeleteSlug.value
  if (!slug) {
    return
  }

  deletingSlug.value = slug
  errorMessage.value = ''
  statusMessage.value = ''

  try {
    await api.request('/api/link/delete', {
      method: 'POST',
      body: { slug },
    })

    await loadLinks()
    toasts.deleted(`/${slug}`, 'Link')
    closeDeleteModal()
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Unable to delete this link.'
    toasts.error('Delete failed', error?.data?.statusMessage || 'Unable to delete this link.')
  } finally {
    deletingSlug.value = null
  }
}

watch(selectedTagId, async () => {
  page.value = 1
  await loadLinks()
})

watch([search, sortBy], () => {
  page.value = 1
})

watch(totalPages, (value) => {
  if (page.value > value) {
    page.value = value
  }
})

watch(
  () => route.query.q,
  (value) => {
    search.value = typeof value === 'string' ? value : ''
  },
)

onMounted(async () => {
  // Load data in parallel for faster initial load
  const [tagsResult, linksResult] = await Promise.allSettled([
    loadTags(),
    loadLinks()
  ])
  
  // Handle any errors from parallel loading
  if (tagsResult.status === 'rejected') {
    console.error('Failed to load tags:', tagsResult.reason)
  }
  if (linksResult.status === 'rejected') {
    console.error('Failed to load links:', linksResult.reason)
  }
})
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Dashboard
          <span class="mx-1 text-slate-400 dark:text-slate-600">/</span>
          <span class="text-brand-700 dark:text-brand-400">Links</span>
        </p>
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Link Management
        </h1>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-slate-600 dark:text-slate-400">Filter by:</span>
          <SySelect
            v-model="selectedTagId"
            :options="[{ label: 'All tags', value: '' }, ...tags.map(t => ({ label: t.name, value: String(t.id) }))]"
            buttonClass="flex h-9 items-center min-w-[120px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 transition-all hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-600 dark:hover:bg-brand-900/20 dark:hover:text-brand-300"
          >
            <template #trigger-icon>
              <UIcon name="lucide:tag" class="h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-brand-500 dark:text-slate-400 dark:group-hover:text-brand-400" />
            </template>
          </SySelect>

          <SySelect
            v-model="sortBy"
            :options="[{ label: 'Recent', value: 'recent' }, { label: 'Top clicks', value: 'clicks' }]"
            buttonClass="flex h-9 items-center min-w-[120px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 transition-all hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-600 dark:hover:bg-brand-900/20 dark:hover:text-brand-300"
          >
            <template #trigger-icon>
              <UIcon name="lucide:arrow-down-narrow-wide" class="h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-brand-500 dark:text-slate-400 dark:group-hover:text-brand-400" />
            </template>
          </SySelect>
        </div>
      </div>
    </div>

    <div v-if="search.trim()" class="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/70 px-3 py-1.5 text-xs text-brand-800 dark:border-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
      <span>Filtering results for "{{ search }}"</span>
      <button type="button" class="font-semibold underline decoration-brand-300 underline-offset-2" @click="clearQuerySearch">
        Clear
      </button>
    </div>

    <p v-if="statusMessage" class="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
      {{ statusMessage }}
    </p>
    <p v-if="errorMessage" class="rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-sm font-medium text-accent-700">
      {{ errorMessage }}
    </p>

    <section class="sy-dashboard-card overflow-hidden">
      <div class="hidden grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_100px_150px] gap-3 border-b border-slate-200 px-4 py-2.5 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:text-slate-400 md:grid">
        <span>Link details</span>
        <span>Tags</span>
        <span>Clicks</span>
        <span class="text-right">Actions</span>
      </div>

      <div v-if="loading" class="space-y-2 px-4 py-4">
        <div
          v-for="placeholder in 5"
          :key="placeholder"
          class="h-20 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-700/50"
        />
      </div>

      <div v-else-if="pagedLinks.length">
        <article
          v-for="link in pagedLinks"
          :key="link.id"
          class="grid w-full cursor-pointer gap-3 border-b px-4 py-2.5 text-left transition last:border-b-0 md:grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_100px_150px]"
          :class="['bg-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/60', 'sy-dashboard-row-divider']"
          role="button"
          tabindex="0"
          :aria-label="`Open analytics for /${link.slug}`"
          @click="openLinkAnalytics(link.slug)"
          @keydown.enter.prevent="openLinkAnalytics(link.slug)"
          @keydown.space.prevent="openLinkAnalytics(link.slug)"
        >
          <div class="min-w-0">
            <p class="truncate text-base font-semibold leading-tight text-[#14736d] dark:text-brand-400">
              /{{ link.slug }}
            </p>
            <p class="truncate text-[0.7rem] text-slate-400 dark:text-slate-500">
              {{ link.url }}
            </p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <UBadge v-if="link.password" color="secondary" variant="soft" size="sm">
                Password
              </UBadge>
              <UBadge v-if="link.unsafe" color="error" variant="soft" size="sm">
                Unsafe
              </UBadge>
              <UBadge v-if="link.cloaking" color="neutral" variant="soft" size="sm">
                Cloak
              </UBadge>
            </div>
            <p class="mt-1.5 text-[0.65rem] text-slate-400 dark:text-slate-500">
              Created {{ formatDate(link.created_at) }}
            </p>
          </div>

          <div class="flex items-start">
            <UBadge v-if="link.tag_id && tagMap[link.tag_id]" color="primary" variant="soft">
              {{ tagMap[link.tag_id]?.name }}
            </UBadge>
            <span v-else class="text-xs text-slate-400 dark:text-slate-500">
              Untagged
            </span>
          </div>

          <div class="flex items-start md:justify-start">
            <span class="text-lg font-semibold leading-none text-slate-900 dark:text-slate-100">
              {{ link.click_count.toLocaleString() }}
            </span>
          </div>

          <div class="flex items-start justify-start gap-1.5 md:justify-end">
            <button
              type="button"
              class="group relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition-all duration-200"
              :class="copiedSlug === link.slug 
                ? 'border-green-300 bg-green-50 text-green-600 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400' 
                : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 hover:shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-brand-500 dark:hover:bg-brand-900/20 dark:hover:text-brand-400'"
              title="Copy short link"
              aria-label="Copy short link"
              @click.stop="copyShortLink(link.slug)"
            >
              <UIcon v-if="copiedSlug === link.slug" name="lucide:check" class="h-4 w-4" />
              <UIcon v-else name="lucide:copy" class="h-4 w-4" />
            </button>

            <button
              type="button"
              class="group inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all duration-200 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-600 hover:shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-purple-500 dark:hover:bg-purple-900/20 dark:hover:text-purple-400"
              title="View QR Code"
              aria-label="View QR Code"
              @click.stop="openQRModal(link.slug)"
            >
              <UIcon name="lucide:qr-code" class="h-4 w-4" />
            </button>

            <a
              :href="`/${link.slug}`"
              target="_blank"
              rel="noopener noreferrer"
              class="group inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all duration-200 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 hover:shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-brand-500 dark:hover:bg-brand-900/20 dark:hover:text-brand-400"
              title="Open link"
              aria-label="Open link in new tab"
              @click.stop
            >
              <UIcon name="lucide:external-link" class="h-4 w-4" />
            </a>

            <button
              type="button"
              class="group inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all duration-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 hover:shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
              title="Edit"
              aria-label="Edit link"
              @click.stop="openEditPage(link.slug)"
            >
              <UIcon name="lucide:square-pen" class="h-4 w-4" />
            </button>

            <button
              type="button"
              class="group inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-red-200 bg-red-50/70 text-red-600 transition-all duration-200 hover:border-red-300 hover:bg-red-100 hover:shadow-sm dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:border-red-700 dark:hover:bg-red-900/40"
              title="Delete"
              aria-label="Delete link"
              @click.stop="requestRemoveLink(link.slug)"
            >
              <UIcon v-if="deletingSlug !== link.slug" name="lucide:trash-2" class="h-4 w-4" />
              <span v-else class="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-700" />
            </button>
          </div>
        </article>
      </div>

      <div v-else class="px-5 py-14 text-center">
        <p class="text-base font-medium text-slate-700 dark:text-slate-300">
          No links found for this filter.
        </p>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Create a new short link or clear the current filters.
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <p>
          <template v-if="sortedLinks.length">
            Showing {{ rangeStart }}-{{ rangeEnd }} of {{ sortedLinks.length }} links
          </template>
          <template v-else>
            No rows to display
          </template>
        </p>

        <div class="flex items-center gap-1.5">
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
            :disabled="page <= 1"
            @click="goToPage(1)"
          >
            <UIcon name="lucide:chevrons-left" class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
            :disabled="page <= 1"
            @click="goToPage(page - 1)"
          >
            <UIcon name="lucide:chevron-left" class="h-4 w-4" />
          </button>

          <span class="px-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            {{ page }} / {{ totalPages }}
          </span>

          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
            :disabled="page >= totalPages"
            @click="goToPage(page + 1)"
          >
            <UIcon name="lucide:chevron-right" class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
            :disabled="page >= totalPages"
            @click="goToPage(totalPages)"
          >
            <UIcon name="lucide:chevrons-right" class="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  </div>

  <!-- Delete Confirmation Modal -->
  <DashboardDeleteModal
    v-model="deleteModalOpen"
    title="Delete Link"
    :description="`Are you sure you want to delete /${pendingDeleteSlug}? This action cannot be undone.`"
    :loading="Boolean(deletingSlug && deletingSlug === pendingDeleteSlug)"
    confirm-label="Delete Link"
    @confirm="confirmRemoveLink"
    @cancel="closeDeleteModal"
  />

  <!-- QR Code Modal -->
  <DashboardQRCodeViewer
    v-if="qrModalSlug"
    v-model="qrModalOpen"
    :slug="qrModalSlug"
  />
</template>
