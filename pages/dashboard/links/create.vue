<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'dashboard-auth',
})

useHead({
  title: 'Create Link | Syano Dashboard',
  meta: [
    { name: 'description', content: 'Create a new shortened link with custom slug and advanced options.' }
  ],
})

import type { SiteSettings } from '~/shared/schemas/settings'

const router = useRouter()
const api = useDashboardApi()

type TagItem = {
  id: string
  name: string
  link_count: number
}

type SenderIdItem = {
  id: string
  name: string
  is_active: boolean
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
  senderId: string
  cloaking: boolean
  redirectWithQuery: boolean
  unsafe: boolean
}

const tags = ref<TagItem[]>([])
const loadingTags = ref(true)
const senderIds = ref<SenderIdItem[]>([])
const loadingSenderIds = ref(false)
const traiEnabled = ref(false)
const saving = ref(false)
const statusMessage = ref('')
const errorMessage = ref('')
const copied = ref(false)
const createdLink = ref<{ slug: string; url: string; short_url: string } | null>(null)
const qrModalOpen = ref(false)

// Accordion toggles
const showExpiration = ref(false)
const showLinkSettings = ref(false)
const showDeviceRedirect = ref(false)

const form = reactive<LinkForm>({
  slug: '',
  url: '',
  comment: '',
  apple: '',
  google: '',
  password: '',
  expiration: '',
  tagId: '',
  senderId: '',
  cloaking: false,
  redirectWithQuery: false,
  unsafe: false,
})

const showUtmBuilder = ref(false)
const utm = reactive({
  source: '',
  medium: '',
  campaign: '',
  term: '',
  content: '',
  referral: ''
})

watch(() => form.url, (newUrl) => {
  try {
    const urlObj = new URL(newUrl)
    utm.source = urlObj.searchParams.get('utm_source') || ''
    utm.medium = urlObj.searchParams.get('utm_medium') || ''
    utm.campaign = urlObj.searchParams.get('utm_campaign') || ''
    utm.term = urlObj.searchParams.get('utm_term') || ''
    utm.content = urlObj.searchParams.get('utm_content') || ''
    utm.referral = urlObj.searchParams.get('ref') || ''
  } catch {
    // invalid url
  }
  
  if (isSlugPristine.value && newUrl) {
    generateSlug(true)
  }
})

watch(utm, () => {
  if (!form.url) return
  try {
    const urlObj = new URL(form.url)
    const update = (key: string, val: string) => {
      if (val) urlObj.searchParams.set(key, val)
      else urlObj.searchParams.delete(key)
    }
    update('utm_source', utm.source)
    update('utm_medium', utm.medium)
    update('utm_campaign', utm.campaign)
    update('utm_term', utm.term)
    update('utm_content', utm.content)
    update('ref', utm.referral)

    const newUrlStr = urlObj.toString()
    if (form.url !== newUrlStr) {
      form.url = newUrlStr
    }
  } catch {
    // waiting for valid base URL
  }
}, { deep: true })


const isSlugPristine = ref(true)

function generateSlug(fromUrl = false) {
  let result = ''
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  
  if (fromUrl === true && form.url) {
    try {
      const url = new URL(form.url)
      const host = url.hostname.replace(/^www\./, '').split('.')[0]
      const path = url.pathname.replace(/^\//, '').replace(/\/$/, '').split('/')
      const lastPath = path[path.length - 1]
      
      const domain = host ? host.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : ''
      let pathName = ''
      if (lastPath && !lastPath.includes('.')) {
        pathName = lastPath.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      }

      let basePrefix = ''
      
      if (domain && pathName) {
        // Extract consonants for smarter abbreviations
        const dConsonants = domain.replace(/[aeiou]/g, '')
        const pConsonants = pathName.replace(/[aeiou]/g, '')
        
        // Format 1: e.g. domain[0] + last consonant + path[0] (google + android -> gla)
        const format1 = domain.charAt(0) + 
                       (dConsonants.length > 2 ? dConsonants.charAt(dConsonants.length - 1) : (domain.charAt(1) || '')) + 
                       pathName.charAt(0)
                       
        // Format 2: e.g. domain[0] + domain consonant + domain last + path consonants (google + android -> glend / gledr)
        const format2 = domain.charAt(0) + 
                       (dConsonants.length > 1 ? dConsonants.charAt(dConsonants.length - 1) : '') + 
                       domain.slice(-1) + 
                       (pConsonants.length > 0 ? pConsonants.charAt(pConsonants.length > 2 ? 1 : 0) : '') +
                       (pConsonants.length > 1 ? pConsonants.charAt(pConsonants.length > 2 ? 2 : 1) : '')
                       
        // Pick one of the formats
        basePrefix = Math.random() > 0.5 ? format1 : format2
        basePrefix = basePrefix.substring(0, 5)
      } else if (pathName && pathName.length >= 3) {
        basePrefix = pathName.substring(0, 3)
      } else if (domain) {
        basePrefix = domain.substring(0, 3)
      }
      
      if (basePrefix.length > 0) {
        result = basePrefix
        // Pad with random characters to ensure uniqueness and reach minimum length
        while (result.length < 5) {
          result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
      }
    } catch {
      // invalid URL, ignore
    }
  }

  // Fallback to purely random if smart generation failed or wasn't requested
  if (!result) {
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
  }
  
  form.slug = result
  isSlugPristine.value = true
}

// Generate slug on mount
onMounted(async () => {
  generateSlug()
  await loadTagsAndSettings()
})

async function loadTagsAndSettings() {
  loadingTags.value = true
  loadingSenderIds.value = true
  try {
    const [settings, tagsResponse] = await Promise.all([
      $fetch<SiteSettings>('/api/settings'),
      api.listTags(),
    ])
    traiEnabled.value = settings.trai_sms_enabled
    tags.value = tagsResponse.data

    if (traiEnabled.value) {
      const sendersResponse = await api.listSenderIds()
      senderIds.value = sendersResponse.data.filter((s: any) => s.is_active)
      
      const defaultSender = senderIds.value.find((s: any) => s.is_default)
      if (defaultSender) {
        form.senderId = defaultSender.id
      }
    }
  } catch {
    // silent
  } finally {
    loadingTags.value = false
    loadingSenderIds.value = false
  }
}

function buildPayload() {
  const payload: any = {
    url: form.url.trim(),
    comment: form.comment.trim() || undefined,
  }

  // Only include slug if user modified it
  if (form.slug.trim()) {
    payload.slug = form.slug.trim()
  }

  // Optional fields
  if (form.tagId) {
    payload.tag_id = form.tagId
  }

  if (traiEnabled.value && form.senderId) {
    payload.sender_id = form.senderId
  }

  if (showExpiration.value && form.expiration) {
    // Convert to Unix timestamp (seconds)
    payload.expiration = Math.floor(new Date(form.expiration).getTime() / 1000)
  }

  if (showLinkSettings.value) {
    if (form.password.trim()) {
      payload.password = form.password.trim()
    }
    payload.cloaking = form.cloaking
    payload.redirect_with_query = form.redirectWithQuery
  }

  if (showDeviceRedirect.value) {
    if (form.apple.trim()) {
      payload.apple = form.apple.trim()
    }
    if (form.google.trim()) {
      payload.google = form.google.trim()
    }
  }

  return payload
}

async function submit() {
  if (!form.url.trim()) {
    errorMessage.value = 'Please enter a destination URL.'
    return
  }

  if (traiEnabled.value && !form.senderId) {
    errorMessage.value = 'Please select a Sender ID (TRAI SMS Compliance is enabled).'
    return
  }

  saving.value = true
  errorMessage.value = ''
  statusMessage.value = ''

  try {
    const response = await api.createLink(buildPayload())
    
    createdLink.value = {
      slug: response.data.slug,
      url: response.data.url,
      short_url: response.data.short_url,
    }
    statusMessage.value = `Link created successfully!`
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.data?.message || 'Unable to create this link.'
  } finally {
    saving.value = false
  }
}

async function copyShortLink() {
  if (!import.meta.client || !createdLink.value) return
  await navigator.clipboard.writeText(createdLink.value.short_url)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function createAnother() {
  createdLink.value = null
  statusMessage.value = ''
  errorMessage.value = ''
  qrModalOpen.value = false
  form.url = ''
  form.comment = ''
  form.apple = ''
  form.google = ''
  form.password = ''
  form.expiration = ''
  form.tagId = ''
  form.senderId = ''
  form.cloaking = false
  form.redirectWithQuery = false
  form.unsafe = false
  generateSlug()
}

const selectedSender = computed(() => senderIds.value.find(s => s.id === form.senderId))

const slugPrefix = computed(() => {
  if (!import.meta.client) return ''
  const prefix = traiEnabled.value && selectedSender.value ? `${selectedSender.value.name}/` : ''
  try {
    const origin = window.location.origin
    return `${origin}/${prefix}`
  } catch {
    return `/${prefix}`
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
          <h1 class="sy-create-title">Create New Link</h1>
          <p class="sy-create-subtitle">Shorten a URL and configure its behavior</p>
        </div>
      </div>
    </div>

    <!-- Success State -->
    <div v-if="createdLink" class="sy-create-success-card">
      <div class="sy-success-icon-wrap">
        <UIcon name="lucide:check" class="h-8 w-8 text-white" />
      </div>

      <h2 class="sy-success-title">Link Created!</h2>
      <p class="sy-success-desc">Your short link is ready to share</p>

      <div class="sy-success-link-box">
        <div class="sy-success-link-row">
          <UIcon name="lucide:globe" class="h-5 w-5 text-brand-600 shrink-0" />
          <span class="sy-success-link-text">{{ createdLink.short_url }}</span>
          <button type="button" class="sy-success-copy-btn" @click="copyShortLink">
            <UIcon v-if="!copied" name="lucide:copy" class="h-4 w-4" />
            <UIcon v-else name="lucide:check" class="h-4 w-4 text-brand-600" />
            <span>{{ copied ? 'Copied!' : 'Copy' }}</span>
          </button>
        </div>
        <p class="sy-success-dest">→ {{ createdLink.url }}</p>
      </div>

      <!-- QR Code Preview -->
      <div class="mt-6 flex flex-col items-center gap-4">
        <p class="text-sm font-medium text-slate-600 dark:text-slate-400">QR Code</p>
        <DashboardQRCodeInline :slug="createdLink.slug" :size="160" />
        <button
          type="button"
          class="sy-success-qr-btn"
          @click="qrModalOpen = true"
        >
          <UIcon name="lucide:download" class="h-4 w-4" />
          <span>Download QR Code</span>
        </button>
      </div>

      <div class="sy-success-actions">
        <UButton size="lg" @click="createAnother">
          Create Another Link
        </UButton>
        <UButton color="neutral" variant="soft" size="lg" @click="router.push('/dashboard/links')">
          View All Links
        </UButton>
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
            <label class="sy-field-label" for="create-url">
              Destination URL
              <span class="sy-field-required">*</span>
            </label>
            <div class="sy-input-wrap sy-input-url">
              <UIcon name="lucide:globe" class="sy-input-icon" />
              <input
                id="create-url"
                v-model="form.url"
                type="url"
                class="sy-input"
                placeholder="https://example.com/your-long-url"
                required
                autofocus
              />
            </div>
          </div>

          <!-- TRAI Sender ID (Conditional) -->
          <div v-if="traiEnabled" class="sy-field">
            <label class="sy-field-label" for="create-sender-id">
              <UIcon name="lucide:radio-tower" class="h-4 w-4" />
              Sender ID
              <span class="sy-field-required">*</span>
            </label>
            <div class="sy-input-wrap">
              <SySelect
                id="create-sender-id"
                v-model="form.senderId"
                :options="[{ label: 'Select Sender ID...', value: '' }, ...senderIds.map(s => ({ label: s.name, value: s.id }))]"
                buttonClass="sy-select justify-between"
              />
            </div>
            <p class="sy-field-hint text-amber-600 dark:text-amber-500">TRAI SMS Compliance is enabled. A Sender ID is required.</p>
          </div>

          <!-- Short Link Preview + Slug -->
          <div class="sy-field">
            <label class="sy-field-label" for="create-slug">
              Short Link
            </label>
            <div class="sy-slug-container">
              <div class="sy-slug-preview">
                <UIcon name="lucide:link-2" class="h-4 w-4 text-slate-400 shrink-0" />
                <span class="sy-slug-domain">{{ slugPrefix }}</span>
              </div>
              <div class="sy-slug-input-group">
                <input
                  id="create-slug"
                  v-model="form.slug"
                  type="text"
                  class="sy-slug-input"
                  placeholder="abc12"
                  maxlength="128"
                  @input="isSlugPristine = false"
                />
                <button
                  type="button"
                  class="sy-slug-regen"
                  title="Generate random slug"
                  @click="() => generateSlug(false)"
                >
                  <UIcon name="lucide:refresh-cw" class="h-4 w-4" />
                </button>
              </div>
            </div>
            <p class="sy-field-hint">Auto-generated 5-character slug. Click the refresh icon to regenerate.</p>
          </div>

          <!-- Tag & Comment Row -->
          <div class="sy-field-row">
            <div class="sy-field sy-field-half">
              <label class="sy-field-label" for="create-tag">
                <UIcon name="lucide:tag" class="h-4 w-4" />
                Tag
              </label>
              <div class="sy-input-wrap">
                <SySelect
                  id="create-tag"
                  v-model="form.tagId"
                  :options="[{ label: 'No tag', value: '' }, ...tags.map(t => ({ label: t.name, value: String(t.id) }))]"
                  buttonClass="sy-select justify-between"
                />
              </div>
            </div>

            <div class="sy-field sy-field-half">
              <label class="sy-field-label" for="create-comment">
                Comment
              </label>
              <div class="sy-input-wrap">
                <input
                  id="create-comment"
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

      <!-- UTM Builder Accordion -->
      <div class="sy-accordion-card" :class="{ 'is-open': showUtmBuilder }">
        <button
          type="button"
          class="sy-accordion-trigger"
          @click="showUtmBuilder = !showUtmBuilder"
        >
          <div class="sy-accordion-trigger-left">
            <div class="sy-accordion-icon" :class="showUtmBuilder ? 'is-active' : ''">
              <UIcon name="lucide:split" class="h-4 w-4" />
            </div>
            <div>
              <span class="sy-accordion-title">UTM Builder</span>
              <span class="sy-accordion-desc">Add UTM parameters to track campaign performance</span>
            </div>
          </div>
          <UIcon name="lucide:chevron-down" class="sy-accordion-chevron" :class="{ 'rotate-180': showUtmBuilder }" />
        </button>
        <div v-if="showUtmBuilder" class="sy-accordion-body">
          <div class="space-y-3">
            <div class="sy-utm-field">
              <div class="sy-utm-label">
                <UIcon name="lucide:globe" class="h-4 w-4" />
                <span>Source</span>
              </div>
              <input v-model="utm.source" type="text" class="sy-utm-input" placeholder="google" />
            </div>
            <div class="sy-utm-field">
              <div class="sy-utm-label">
                <UIcon name="lucide:rss" class="h-4 w-4" />
                <span>Medium</span>
              </div>
              <input v-model="utm.medium" type="text" class="sy-utm-input" placeholder="cpc" />
            </div>
            <div class="sy-utm-field">
              <div class="sy-utm-label">
                <UIcon name="lucide:flag" class="h-4 w-4" />
                <span>Campaign</span>
              </div>
              <input v-model="utm.campaign" type="text" class="sy-utm-input" placeholder="summer sale" />
            </div>
            <div class="sy-utm-field">
              <div class="sy-utm-label">
                <UIcon name="lucide:text-search" class="h-4 w-4" />
                <span>Term</span>
              </div>
              <input v-model="utm.term" type="text" class="sy-utm-input" placeholder="running shoes" />
            </div>
            <div class="sy-utm-field">
              <div class="sy-utm-label">
                <UIcon name="lucide:file-text" class="h-4 w-4" />
                <span>Content</span>
              </div>
              <input v-model="utm.content" type="text" class="sy-utm-input" placeholder="logo link" />
            </div>
            <div class="sy-utm-field">
              <div class="sy-utm-label">
                <UIcon name="lucide:gift" class="h-4 w-4" />
                <span>Referral</span>
              </div>
              <input v-model="utm.referral" type="text" class="sy-utm-input" placeholder="yoursite.com" />
            </div>

            <div v-if="form.url" class="mt-5">
              <h4 class="sy-utm-preview-header">URL Preview</h4>
              <div class="sy-utm-preview-box">
                {{ form.url }}
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
            <label class="sy-field-label" for="create-expiration">
              <UIcon name="lucide:calendar-days" class="h-4 w-4" />
              Expiration Date & Time
            </label>
            <div class="sy-input-wrap">
              <input
                id="create-expiration"
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
            <label class="sy-field-label" for="create-password">
              <UIcon name="lucide:lock" class="h-4 w-4" />
              Password Protection
            </label>
            <div class="sy-input-wrap">
              <UIcon name="lucide:lock" class="sy-input-icon" />
              <input
                id="create-password"
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
                  id="create-cloaking"
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
                  id="create-unsafe"
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
            <label class="sy-field-label" for="create-apple">
              Apple / iOS URL
            </label>
            <div class="sy-input-wrap">
              <input
                id="create-apple"
                v-model="form.apple"
                type="url"
                class="sy-input"
                placeholder="https://apps.apple.com/..."
              />
            </div>
          </div>
          <div class="sy-field">
            <label class="sy-field-label" for="create-google">
              Android / Google Play URL
            </label>
            <div class="sy-input-wrap">
              <input
                id="create-google"
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

      <!-- Submit -->
      <div class="sy-create-submit-row">
        <UButton type="submit" size="xl" :loading="saving" class="sy-create-submit-btn">
          <UIcon name="lucide:link-2" class="h-4 w-4" />
          Create Link
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

  <!-- QR Code Modal -->
  <DashboardQRCodeViewer
    v-if="createdLink"
    v-model="qrModalOpen"
    :slug="createdLink.slug"
  />
</template>
