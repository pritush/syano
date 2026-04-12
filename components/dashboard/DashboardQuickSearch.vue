<script setup lang="ts">
type SearchItem = {
  slug: string
  url: string
  comment: string | null
}

const api = useDashboardApi()
const route = useRoute()

const containerRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const search = ref('')
const results = ref<SearchItem[]>([])
const loading = ref(false)
const open = ref(false)
let debounceHandle: ReturnType<typeof setTimeout> | null = null

async function runSearch() {
  const query = search.value.trim()

  if (!query) {
    results.value = []
    loading.value = false
    return
  }

  loading.value = true

  try {
    const response = await api.request<{ items: SearchItem[] }>('/api/link/search', {
      query: {
        q: query,
        limit: 8,
      },
    })
    results.value = response.items
  } finally {
    loading.value = false
  }
}

watch(search, () => {
  open.value = true

  if (debounceHandle) {
    clearTimeout(debounceHandle)
  }

  debounceHandle = setTimeout(() => {
    runSearch()
  }, 180)
})

watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)

function openSearchResult(slug: string) {
  open.value = false
  navigateTo({
    path: '/dashboard/links',
    query: {
      q: slug,
    },
  })
}

function submitSearch() {
  const query = search.value.trim()

  if (!query) {
    return
  }

  open.value = false
  navigateTo({
    path: '/dashboard/links',
    query: {
      q: query,
    },
  })
}

function handleWindowKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    open.value = true
    inputRef.value?.focus()
  }

  if (event.key === 'Escape') {
    open.value = false
  }
}

function handlePointerDown(event: PointerEvent) {
  if (!containerRef.value) {
    return
  }

  const target = event.target as Node | null

  if (target && !containerRef.value.contains(target)) {
    open.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
  window.addEventListener('pointerdown', handlePointerDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
  window.removeEventListener('pointerdown', handlePointerDown)

  if (debounceHandle) {
    clearTimeout(debounceHandle)
  }
})
</script>

<template>
  <div ref="containerRef" class="relative min-w-[220px] flex-1 max-w-xl">
    <form class="relative" @submit.prevent="submitSearch">
      <UIcon name="lucide:search" class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref="inputRef"
        v-model="search"
        type="search"
        placeholder="Search links..."
        class="h-10 w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-20 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-brand-600 dark:focus:ring-brand-900/30"
        @focus="open = true"
      >
      <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400">
        Ctrl+K
      </span>
    </form>

    <div
      v-if="open && (search.trim() || results.length)"
      class="absolute inset-x-0 top-[calc(100%+0.6rem)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30"
    >
      <div v-if="loading" class="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
        Searching links...
      </div>

      <div v-else-if="results.length" class="divide-y divide-slate-100 dark:divide-slate-700">
        <div class="bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          Quick matches
        </div>

        <button
          v-for="result in results"
          :key="`${result.slug}-${result.url}`"
          type="button"
          class="block w-full px-4 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
          @click="openSearchResult(result.slug)"
        >
          <p class="font-semibold text-brand-700 dark:text-brand-400">
            /{{ result.slug }}
          </p>
          <p class="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">
            {{ result.url }}
          </p>
          <p v-if="result.comment" class="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
            {{ result.comment }}
          </p>
        </button>
      </div>

      <div v-else class="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
        No links matched that search yet.
      </div>
    </div>
  </div>
</template>
