<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'dashboard-auth',
})

const route = useRoute()
const router = useRouter()
const api = useDashboardApi()

const linkSlug = computed(() => String(route.params.slug || ''))

useHead({
  title: () => `Edit /${linkSlug.value} | Syano Dashboard`,
  meta: [
    { name: 'description', content: 'Edit link settings, update destination URL, and manage advanced options.' }
  ],
})

type TagItem = {
  id: string
  name: string
  link_count: number
}

type LinkForm = {
  slug: string
  url: string
  comment: string
  apple: string
  google: string
  password: string
  expiration: string
  tagId: string
  cloaking: boolean
  redirectWithQuery: boolean
  unsafe: boolean
}

const tags = ref<TagItem[]>([])
const loading = ref(true)
const saving = ref(false)
const statusMessage = ref('')
const errorMessage = ref('')

// Accordion toggles
const showExpiration = ref(false)
const showLinkSettings = ref(false)
const showDeviceRedirect = ref(false)

const form = reactive<LinkForm>({
  slug: linkSlug.value,
  url: '',
  comment: '',
  apple: '',
  google: '',
  password: '',
  expiration: '',
  tagId: '',
  cloaking: false,
  redirectWithQuery: false,
  unsafe: false,
})

function toDateTimeLocal(value: any) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

onMounted(async () => {
  await Promise.all([loadTags(), loadLink()])
})

async function loadTags() {
  try {
    const response = await api.request<{ items: TagItem[] }>('/api/tags/list')
    tags.value = response.items
  } catch {
    // silent
  }
}

async function loadLink() {
  loading.value = true
  errorMessage.value = ''
  try {
    const data = await api.request<any>('/api/link/query', {
      query: { slug: linkSlug.value },
    })

    form.url = data.url
    form.comment = data.comment || ''
    form.tagId = data.tag_id || ''

    if (data.expiration) {
      form.expiration = toDateTimeLocal(data.expiration)
      showExpiration.value = true
    }

    if (data.password || data.cloaking || data.redirect_with_query || data.unsafe) {
      showLinkSettings.value = true
      form.password = data.password || ''
      form.cloaking = data.cloaking
      form.redirectWithQuery = data.redirect_with_query
      form.unsafe = data.unsafe
    }

    if (data.apple || data.google) {
      showDeviceRedirect.value = true
      form.apple = data.apple || ''
      form.google = data.google || ''
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || 'Failed to load link details.'
  } finally {
    loading.value = false
  }
}

function buildPayload() {
  return {
    url: form.url.trim(),
    comment: form.comment.trim() || null,
    apple: showDeviceRedirect.value ? (form.apple.trim() || null) : null,
    google: showDeviceRedirect.value ? (form.google.trim() || null) : null,
    password: showLinkSettings.value ? (form.password.trim() || null) : null,
    expiration: showExpiration.value && form.expiration ? new Date(form.expiration).toISOString() : null,
    tag_id: form.tagId || null,
    cloaking: showLinkSettings.value ? form.cloaking : false,
    redirect_with_query: showLinkSettings.value ? form.redirectWithQuery : false,
    unsafe: showLinkSettings.value ? form.unsafe : false,
  }
}

async function submit() {
  if (!form.url.trim()) {
    errorMessage.value = 'Please enter a destination URL.'
    return
  }

  saving.value = true
  errorMessage.value = ''
  statusMessage.value = ''

  try {
    await api.request('/api/link/edit', {
      method: 'PUT',
      body: {
        slug: linkSlug.value,
        ...buildPayload(),
      },
    })

    statusMessage.value = `Link updated successfully!`
    setTimeout(() => {
      router.push('/dashboard/links')
    }, 1500)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Unable to save this link.'
  } finally {
    saving.value = false
  }
}

const shortLinkPreview = computed(() => {
  if (!import.meta.client) return ''
  try {
    const origin = window.location.origin
    return `${origin}/${form.slug}`
  } catch {
    return `/${form.slug}`
  }
})
</script>

<template>
  <div class="sy-create-link-page">
    <!-- Header -->
    <div class="sy-create-header">
      <button
        type="button"
        class="sy-back-button"
        @click="router.push('/dashboard/links')"
      >
        <UIcon name="lucide:arrow-left" class="h-4 w-4" />
        <span>Back to Links</span>
      </button>

      <div class="sy-create-title-row">
        <div class="sy-create-title-icon">
          <UIcon name="lucide:link-2" class="h-5 w-5" />
        </div>
        <div>
          <h1 class="sy-create-title">Edit Link</h1>
          <p class="sy-create-subtitle">Update destination and settings for /{{ linkSlug }}</p>
        </div>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="sy-form-card p-6">
      <div class="flex animate-pulse space-x-4">
        <div class="flex-1 space-y-6 py-1">
          <div class="h-4 w-3/4 rounded bg-slate-200"></div>
          <div class="space-y-3">
            <div class="h-10 rounded bg-slate-200"></div>
            <div class="h-10 rounded bg-slate-200"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Form -->
    <form v-else class="sy-create-form" @submit.prevent="submit">
      <!-- Main Fields Card -->
      <div class="sy-form-card">
        <div class="sy-form-card-header">
          <UIcon name="lucide:globe" class="h-5 w-5 text-brand-600" />
          <span>Link Details</span>
        </div>

        <div class="sy-form-card-body">
          <!-- Destination URL -->
          <div class="sy-field">
            <label class="sy-field-label" for="edit-url">
              Destination URL
              <span class="sy-field-required">*</span>
            </label>
            <div class="sy-input-wrap sy-input-url">
              <UIcon name="lucide:globe" class="sy-input-icon" />
              <input
                id="edit-url"
                v-model="form.url"
                type="url"
                class="sy-input"
                placeholder="https://example.com/your-long-url"
                required
              />
            </div>
          </div>

          <!-- Short Link Preview + Slug -->
          <div class="sy-field">
            <label class="sy-field-label">
              Short Link
            </label>
            <div class="sy-slug-container">
              <div class="sy-slug-preview">
                <UIcon name="lucide:link-2" class="h-4 w-4 text-slate-400 shrink-0" />
                <span class="sy-slug-domain">{{ shortLinkPreview.split('/').slice(0, 3).join('/') }}/</span>
              </div>
              <div class="sy-slug-input-group">
                <input
                  v-model="form.slug"
                  type="text"
                  class="sy-slug-input disabled"
                  disabled
                />
              </div>
            </div>
            <p class="sy-field-hint">The slug cannot be changed after creation.</p>
          </div>

          <!-- Tag & Comment Row -->
          <div class="sy-field-row">
            <div class="sy-field sy-field-half">
              <label class="sy-field-label" for="edit-tag">
                <UIcon name="lucide:tag" class="h-4 w-4" />
                Tag
              </label>
              <div class="sy-input-wrap">
                <SySelect
                  id="edit-tag"
                  v-model="form.tagId"
                  :options="[{ label: 'No tag', value: '' }, ...tags.map(t => ({ label: t.name, value: String(t.id) }))]"
                  buttonClass="sy-select justify-between"
                />
              </div>
            </div>

            <div class="sy-field sy-field-half">
              <label class="sy-field-label" for="edit-comment">
                Comment
              </label>
              <div class="sy-input-wrap">
                <input
                  id="edit-comment"
                  v-model="form.comment"
                  type="text"
                  class="sy-input"
                  placeholder="Internal note (optional)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Expiration Accordion -->
      <div class="sy-accordion-card" :class="{ 'is-open': showExpiration }">
        <button
          type="button"
          class="sy-accordion-trigger"
          @click="showExpiration = !showExpiration"
        >
          <div class="sy-accordion-trigger-left">
            <div class="sy-accordion-icon" :class="showExpiration ? 'is-active' : ''">
              <UIcon name="lucide:clock-3" class="h-4 w-4" />
            </div>
            <div>
              <span class="sy-accordion-title">Expiration</span>
              <span class="sy-accordion-desc">Set when this link should expire</span>
            </div>
          </div>
          <UIcon name="lucide:chevron-down" class="sy-accordion-chevron" :class="{ 'rotate-180': showExpiration }" />
        </button>
        <div v-if="showExpiration" class="sy-accordion-body">
          <div class="sy-field">
            <label class="sy-field-label" for="edit-expiration">
              <UIcon name="lucide:calendar-days" class="h-4 w-4" />
              Expiration Date & Time
            </label>
            <div class="sy-input-wrap">
              <input
                id="edit-expiration"
                v-model="form.expiration"
                type="datetime-local"
                class="sy-input"
              />
            </div>
            <p class="sy-field-hint">The link will stop working after this date.</p>
          </div>
        </div>
      </div>

      <!-- Link Settings Accordion -->
      <div class="sy-accordion-card" :class="{ 'is-open': showLinkSettings }">
        <button
          type="button"
          class="sy-accordion-trigger"
          @click="showLinkSettings = !showLinkSettings"
        >
          <div class="sy-accordion-trigger-left">
            <div class="sy-accordion-icon" :class="showLinkSettings ? 'is-active' : ''">
              <UIcon name="lucide:settings-2" class="h-4 w-4" />
            </div>
            <div>
              <span class="sy-accordion-title">Link Settings</span>
              <span class="sy-accordion-desc">Password, cloaking, and redirect options</span>
            </div>
          </div>
          <UIcon name="lucide:chevron-down" class="sy-accordion-chevron" :class="{ 'rotate-180': showLinkSettings }" />
        </button>
        <div v-if="showLinkSettings" class="sy-accordion-body">
          <div class="sy-field">
            <label class="sy-field-label" for="edit-password">
              <UIcon name="lucide:lock" class="h-4 w-4" />
              Password Protection
            </label>
            <div class="sy-input-wrap">
              <UIcon name="lucide:lock" class="sy-input-icon" />
              <input
                id="edit-password"
                v-model="form.password"
                type="password"
                class="sy-input"
                placeholder="Leave empty for no password"
              />
            </div>
            <p class="sy-field-hint">Visitors will need this password to access the link.</p>
          </div>

          <div class="sy-toggles-group">
            <div class="sy-toggle-row">
              <div class="sy-toggle-info">
                <span class="sy-toggle-label">Link Cloaking</span>
                <span class="sy-toggle-desc">Display destination in an iframe (some sites may block this)</span>
              </div>
              <div class="sy-toggle-switch">
                <input
                  id="edit-cloaking"
                  v-model="form.cloaking"
                  type="checkbox"
                  class="sr-only"
                />
                <button
                  type="button"
                  class="sy-toggle-track"
                  :class="{ 'is-on': form.cloaking }"
                  @click="form.cloaking = !form.cloaking"
                  aria-label="Toggle link cloaking"
                >
                  <div class="sy-toggle-thumb" />
                </button>
              </div>
            </div>

            <div class="sy-toggle-row">
              <div class="sy-toggle-info">
                <span class="sy-toggle-label">Mark as Unsafe</span>
                <span class="sy-toggle-desc">Flag this link for review or restricted access</span>
              </div>
              <div class="sy-toggle-switch">
                <input
                  id="edit-unsafe"
                  v-model="form.unsafe"
                  type="checkbox"
                  class="sr-only"
                />
                <button
                  type="button"
                  class="sy-toggle-track"
                  :class="{ 'is-on': form.unsafe }"
                  @click="form.unsafe = !form.unsafe"
                  aria-label="Toggle mark as unsafe"
                >
                  <div class="sy-toggle-thumb" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Device Redirect Accordion -->
      <div class="sy-accordion-card" :class="{ 'is-open': showDeviceRedirect }">
        <button
          type="button"
          class="sy-accordion-trigger"
          @click="showDeviceRedirect = !showDeviceRedirect"
        >
          <div class="sy-accordion-trigger-left">
            <div class="sy-accordion-icon" :class="showDeviceRedirect ? 'is-active' : ''">
              <UIcon name="lucide:smartphone" class="h-4 w-4" />
            </div>
            <div>
              <span class="sy-accordion-title">Device Redirect</span>
              <span class="sy-accordion-desc">Set different URLs for iOS and Android</span>
            </div>
          </div>
          <UIcon name="lucide:chevron-down" class="sy-accordion-chevron" :class="{ 'rotate-180': showDeviceRedirect }" />
        </button>
        <div v-if="showDeviceRedirect" class="sy-accordion-body">
          <div class="sy-field">
            <label class="sy-field-label" for="edit-apple">
              Apple / iOS URL
            </label>
            <div class="sy-input-wrap">
              <input
                id="edit-apple"
                v-model="form.apple"
                type="url"
                class="sy-input"
                placeholder="https://apps.apple.com/..."
              />
            </div>
          </div>
          <div class="sy-field">
            <label class="sy-field-label" for="edit-google">
              Android / Google Play URL
            </label>
            <div class="sy-input-wrap">
              <input
                id="edit-google"
                v-model="form.google"
                type="url"
                class="sy-input"
                placeholder="https://play.google.com/..."
              />
            </div>
          </div>
          <p class="sy-field-hint">Visitors on iOS or Android will be redirected to these URLs instead.</p>
        </div>
      </div>

      <!-- Error / Status -->
      <p v-if="errorMessage" class="sy-create-error">
        {{ errorMessage }}
      </p>
      <p v-if="statusMessage" class="sy-create-status rounded-lg bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700">
        {{ statusMessage }}
      </p>

      <!-- Submit -->
      <div class="sy-create-submit-row">
        <UButton type="submit" size="xl" :loading="saving" class="sy-create-submit-btn">
          <UIcon name="lucide:link-2" class="h-4 w-4" />
          Save Changes
        </UButton>
        <UButton
          color="neutral"
          variant="ghost"
          size="lg"
          @click="router.push('/dashboard/links')"
        >
          Cancel
        </UButton>
      </div>
    </form>
  </div>
</template>
