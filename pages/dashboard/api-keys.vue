<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useHead({ title: 'API Keys — Syano' })

const { request } = useDashboardApi()
const toasts = useToasts()

// ── State ─────────────────────────────────────────
interface ApiKeyRow {
  id: string
  name: string
  key_prefix: string
  permissions: string[]
  is_active: boolean
  last_used_at: string | null
  expires_at: string | null
  created_at: string
  can_reveal?: string | null // Encrypted key data (null if not available)
}

const apiKeys = ref<ApiKeyRow[]>([])
const loading = ref(true)
const encryptionAvailable = ref(true) // Track if encryption feature is available

// Modal state
const showCreateModal = ref(false)
const showKeyModal = ref(false)
const createdKey = ref('')
const createdKeyData = ref<any>(null)

// Form
const form = reactive({
  name: '',
  permissions: [] as string[],
  expires_in_days: null as number | null,
})
const formErrors = ref<Record<string, string>>({})
const submitting = ref(false)

// Delete state
const showDeleteConfirm = ref(false)
const deletingKey = ref<ApiKeyRow | null>(null)
const deleting = ref(false)

// View state
const showViewModal = ref(false)
const viewingKey = ref<ApiKeyRow | null>(null)

// Reveal key state
const showRevealModal = ref(false)
const revealingKey = ref<ApiKeyRow | null>(null)
const revealedKey = ref('')
const revealLoading = ref(false)

// ── Available Permissions ─────────────────────────
const availablePermissions = [
  { key: '*', label: 'Full Access', description: 'All permissions' },
  { key: 'links:create', label: 'Create Links', description: 'Create new short links' },
  { key: 'links:read', label: 'Read Links', description: 'View links and details' },
  { key: 'links:update', label: 'Update Links', description: 'Modify existing links' },
  { key: 'links:delete', label: 'Delete Links', description: 'Remove links' },
  { key: 'analytics:read', label: 'Read Analytics', description: 'View analytics data' },
  { key: 'tags:create', label: 'Create Tags', description: 'Create new tags' },
  { key: 'tags:read', label: 'Read Tags', description: 'View tags' },
]

// ── Data Fetching ─────────────────────────────────
async function fetchApiKeys() {
  loading.value = true
  try {
    const response = await request<{ success: boolean; data: ApiKeyRow[]; encryption_available?: boolean }>('/api/v1/api-keys')
    apiKeys.value = response.data
    encryptionAvailable.value = response.encryption_available !== false
  } catch (err: any) {
    toasts.error('Failed to load API keys', err?.data?.statusMessage || 'Unknown error')
  } finally {
    loading.value = false
  }
}

onMounted(fetchApiKeys)

// ── Create API Key ────────────────────────────────
function openCreateModal() {
  form.name = ''
  form.permissions = []
  form.expires_in_days = null
  formErrors.value = {}
  showCreateModal.value = true
}

function togglePermission(key: string) {
  const idx = form.permissions.indexOf(key)
  if (idx >= 0) {
    form.permissions.splice(idx, 1)
  } else {
    form.permissions.push(key)
  }
}

async function createApiKey() {
  formErrors.value = {}
  
  if (!form.name.trim()) {
    formErrors.value.name = 'Name is required'
    return
  }
  
  if (form.permissions.length === 0) {
    formErrors.value.permissions = 'At least one permission is required'
    return
  }
  
  submitting.value = true
  try {
    const response = await request<{ success: boolean; data: any; message: string }>('/api/v1/api-keys', {
      method: 'POST',
      body: {
        name: form.name,
        permissions: form.permissions,
        expires_in_days: form.expires_in_days,
      },
    })
    
    createdKey.value = response.data.key
    createdKeyData.value = response.data
    showCreateModal.value = false
    showKeyModal.value = true
    
    await fetchApiKeys()
    toasts.success('API key created successfully')
  } catch (err: any) {
    toasts.error('Failed to create API key', err?.data?.statusMessage || 'Unknown error')
  } finally {
    submitting.value = false
  }
}

// ── View API Key ──────────────────────────────────
function viewKey(key: ApiKeyRow) {
  viewingKey.value = key
  showViewModal.value = true
}

// ── Reveal Full API Key ───────────────────────────
async function revealKey(key: ApiKeyRow) {
  if (!key.can_reveal) {
    toasts.error(
      'Cannot reveal key',
      'This API key was created before encryption was enabled. Please create a new API key.'
    )
    return
  }
  
  revealingKey.value = key
  revealedKey.value = ''
  showRevealModal.value = true
  revealLoading.value = true
  
  try {
    const response = await request<{ success: boolean; data: { key: string } }>(`/api/v1/api-keys/${key.id}/reveal`)
    revealedKey.value = response.data.key
  } catch (err: any) {
    const errorMessage = err?.data?.message || err?.data?.statusMessage || 'Unknown error'
    toasts.error('Failed to reveal API key', errorMessage)
    showRevealModal.value = false
  } finally {
    revealLoading.value = false
  }
}

// ── Delete API Key ────────────────────────────────
function confirmDelete(key: ApiKeyRow) {
  deletingKey.value = key
  showDeleteConfirm.value = true
}

async function deleteApiKey() {
  if (!deletingKey.value) return
  
  deleting.value = true
  try {
    await request(`/api/v1/api-keys/${deletingKey.value.id}`, {
      method: 'DELETE',
    })
    
    toasts.success('API key revoked successfully')
    showDeleteConfirm.value = false
    deletingKey.value = null
    await fetchApiKeys()
  } catch (err: any) {
    toasts.error('Failed to revoke API key', err?.data?.statusMessage || 'Unknown error')
  } finally {
    deleting.value = false
  }
}

// ── Copy to Clipboard ─────────────────────────────
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toasts.success('Copied to clipboard')
  } catch (err) {
    toasts.error('Failed to copy to clipboard')
  }
}

// ── Formatting ────────────────────────────────────
function formatDate(date: string | null) {
  if (!date) return 'Never'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isExpired(date: string | null) {
  if (!date) return false
  return new Date(date) < new Date()
}

</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">API Keys</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Manage API keys for programmatic access to your links
        </p>
      </div>
      <UButton
        icon="i-lucide-plus"
        label="Create API Key"
        color="primary"
        @click="openCreateModal"
      />
    </div>

    <!-- Database Upgrade Notice -->
    <UAlert
      v-if="!loading && !encryptionAvailable"
      icon="i-lucide-info"
      color="info"
      variant="subtle"
      title="Database Upgrade Required"
      description="To enable the 'Reveal API Key' feature, please run the database upgrade from Data Ops."
    />

    <!-- Old Keys Notice -->
    <UAlert
      v-if="!loading && encryptionAvailable && apiKeys.length > 0 && apiKeys.every(k => !k.can_reveal)"
      icon="i-lucide-info"
      color="warning"
      variant="subtle"
      title="Old API Keys Cannot Be Revealed"
      description="These API keys were created before the encryption feature. Create new API keys to use the reveal feature, then revoke the old ones."
    />

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-gray-400" />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="apiKeys.length === 0"
      class="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 text-center"
    >
      <UIcon name="i-lucide-key" class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">No API keys</h3>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Get started by creating your first API key
      </p>
      <UButton
        icon="i-lucide-plus"
        label="Create API Key"
        color="primary"
        class="mt-6"
        @click="openCreateModal"
      />
    </div>

    <!-- API Keys List -->
    <div v-else class="space-y-4">
      <div
        v-for="key in apiKeys"
        :key="key.id"
        class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-3">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ key.name }}
              </h3>
              <UBadge
                v-if="!key.is_active"
                color="neutral"
                variant="subtle"
                label="Inactive"
              />
              <UBadge
                v-else-if="isExpired(key.expires_at)"
                color="error"
                variant="subtle"
                label="Expired"
              />
              <UBadge
                v-else
                color="success"
                variant="subtle"
                label="Active"
              />
            </div>
            
            <div class="mt-3 space-y-2">
              <div class="flex items-center gap-2 text-sm">
                <span class="text-gray-600 dark:text-gray-400">Key:</span>
                <code class="px-2 py-1 bg-gray-100 dark:bg-gray-900 rounded text-gray-900 dark:text-white font-mono">
                  {{ key.key_prefix }}••••••••••••••••
                </code>
                <UBadge
                  v-if="key.can_reveal"
                  color="success"
                  variant="subtle"
                  size="xs"
                  title="This key can be revealed"
                >
                  <UIcon name="i-lucide-eye" class="h-3 w-3" />
                </UBadge>
                <UBadge
                  v-else
                  color="neutral"
                  variant="subtle"
                  size="xs"
                  title="This key cannot be revealed (created before encryption)"
                >
                  <UIcon name="i-lucide-eye-off" class="h-3 w-3" />
                </UBadge>
              </div>
              
              <div class="flex items-center gap-2 text-sm">
                <span class="text-gray-600 dark:text-gray-400">Permissions:</span>
                <div class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="perm in key.permissions"
                    :key="perm"
                    color="info"
                    variant="subtle"
                    size="xs"
                  >
                    {{ perm }}
                  </UBadge>
                </div>
              </div>
              
              <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>Created: {{ formatDate(key.created_at) }}</span>
                <span v-if="key.last_used_at">Last used: {{ formatDate(key.last_used_at) }}</span>
                <span v-else>Never used</span>
                <span v-if="key.expires_at">Expires: {{ formatDate(key.expires_at) }}</span>
              </div>
            </div>
          </div>
          
          <div class="flex gap-2">
            <UButton
              icon="i-lucide-eye"
              color="primary"
              variant="ghost"
              size="sm"
              :title="key.can_reveal ? 'Reveal full key' : 'Key cannot be revealed (created before encryption)'"
              :disabled="!key.can_reveal"
              @click="revealKey(key)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              title="Revoke key"
              @click="confirmDelete(key)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Create API Key Modal -->
    <UModal v-model:open="showCreateModal" title="Create API Key" description="Generate a new API key for programmatic access">
      <template #body>
        <div class="space-y-4">
          <!-- Name -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name <span class="text-red-500">*</span>
            </label>
            <UInput
              v-model="form.name"
              placeholder="My API Key"
              :color="formErrors.name ? 'error' : undefined"
            />
            <p v-if="formErrors.name" class="mt-1 text-sm text-red-600">
              {{ formErrors.name }}
            </p>
          </div>

          <!-- Permissions -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Permissions <span class="text-red-500">*</span>
            </label>
            <div class="space-y-2 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <label
                v-for="perm in availablePermissions"
                :key="perm.key"
                class="flex items-start gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded-md transition-colors"
              >
                <UCheckbox
                  :model-value="form.permissions.includes(perm.key)"
                  @update:model-value="togglePermission(perm.key)"
                  @click.stop
                />
                <div class="flex-1" @click="togglePermission(perm.key)">
                  <div class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ perm.label }}
                  </div>
                  <div class="text-xs text-gray-600 dark:text-gray-400">
                    {{ perm.description }}
                  </div>
                </div>
              </label>
            </div>
            <p v-if="formErrors.permissions" class="mt-1 text-sm text-red-600">
              {{ formErrors.permissions }}
            </p>
          </div>

          <!-- Expiration -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Expires in (days)
            </label>
            <UInput
              v-model.number="form.expires_in_days"
              type="number"
              placeholder="Leave empty for no expiration"
              min="1"
              max="365"
            />
            <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Optional. Maximum 365 days.
            </p>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="showCreateModal = false"
            :disabled="submitting"
          />
          <UButton
            label="Create API Key"
            color="primary"
            @click="createApiKey"
            :loading="submitting"
          />
        </div>
      </template>
    </UModal>

    <!-- Show Created Key Modal -->
    <UModal v-model:open="showKeyModal" title="API Key Created" :dismissible="false">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-check-circle" class="h-5 w-5 text-green-500" />
          <span class="text-lg font-semibold text-gray-900 dark:text-white">API Key Created</span>
        </div>
      </template>

      <template #body>
        <div class="space-y-4">
          <UAlert
            icon="i-lucide-alert-triangle"
            color="warning"
            variant="subtle"
            title="Important"
            description="Make sure to copy your API key now. You won't be able to see it again!"
          />

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your API Key
            </label>
            <div class="flex gap-2">
              <UInput
                :model-value="createdKey"
                readonly
                class="flex-1 font-mono text-sm"
              />
              <UButton
                icon="i-lucide-copy"
                color="neutral"
                @click="copyToClipboard(createdKey)"
              />
            </div>
          </div>

          <div class="text-sm text-gray-600 dark:text-gray-400">
            <p class="font-medium mb-2">Usage:</p>
            <pre class="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg overflow-x-auto"><code>curl -H "Authorization: Bearer {{ createdKey }}" \
  https://your-domain.com/api/v1/links</code></pre>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end">
          <UButton
            label="I've saved my API key"
            color="primary"
            @click="showKeyModal = false"
          />
        </div>
      </template>
    </UModal>

    <!-- View API Key Modal -->
    <UModal v-model:open="showViewModal" title="API Key Details">
      <template #body>
        <div v-if="viewingKey" class="space-y-4">
          <!-- Name -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <p class="text-base text-gray-900 dark:text-white">
              {{ viewingKey.name }}
            </p>
          </div>

          <!-- Status -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <div>
              <UBadge
                v-if="!viewingKey.is_active"
                color="neutral"
                variant="subtle"
                label="Inactive"
              />
              <UBadge
                v-else-if="isExpired(viewingKey.expires_at)"
                color="error"
                variant="subtle"
                label="Expired"
              />
              <UBadge
                v-else
                color="success"
                variant="subtle"
                label="Active"
              />
            </div>
          </div>

          <!-- Key Prefix -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Key Prefix
            </label>
            <div class="flex gap-2">
              <code class="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-900 rounded text-gray-900 dark:text-white font-mono text-sm border border-gray-200 dark:border-gray-700">
                {{ viewingKey.key_prefix }}••••••••••••••••
              </code>
              <UButton
                icon="i-lucide-copy"
                color="neutral"
                @click="copyToClipboard(viewingKey.key_prefix)"
                title="Copy prefix"
              />
            </div>
            <div class="mt-2 flex gap-2">
              <UButton
                icon="i-lucide-eye"
                label="Reveal Full Key"
                color="primary"
                variant="soft"
                size="sm"
                @click="revealKey(viewingKey)"
              />
            </div>
          </div>

          <!-- Permissions -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Permissions
            </label>
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="perm in viewingKey.permissions"
                :key="perm"
                color="info"
                variant="subtle"
              >
                {{ perm }}
              </UBadge>
            </div>
          </div>

          <!-- Dates -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Created
              </label>
              <p class="text-sm text-gray-900 dark:text-white">
                {{ formatDate(viewingKey.created_at) }}
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last Used
              </label>
              <p class="text-sm text-gray-900 dark:text-white">
                {{ viewingKey.last_used_at ? formatDate(viewingKey.last_used_at) : 'Never' }}
              </p>
            </div>

            <div v-if="viewingKey.expires_at">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expires
              </label>
              <p class="text-sm" :class="isExpired(viewingKey.expires_at) ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'">
                {{ formatDate(viewingKey.expires_at) }}
              </p>
            </div>
            <div v-else>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expires
              </label>
              <p class="text-sm text-gray-900 dark:text-white">
                Never
              </p>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end">
          <UButton
            label="Close"
            color="neutral"
            @click="showViewModal = false"
          />
        </div>
      </template>
    </UModal>

    <!-- Reveal API Key Modal -->
    <UModal v-model:open="showRevealModal" title="Reveal API Key">
      <template #body>
        <div v-if="revealingKey" class="space-y-4">
          <UAlert
            icon="i-lucide-alert-triangle"
            color="warning"
            variant="subtle"
            title="Security Warning"
            description="Keep your API key secure. Anyone with this key can access your account with the granted permissions."
          />

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              API Key Name
            </label>
            <p class="text-base text-gray-900 dark:text-white">
              {{ revealingKey.name }}
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Full API Key
            </label>
            <div v-if="revealLoading" class="flex items-center justify-center py-8">
              <UIcon name="i-lucide-loader-2" class="h-6 w-6 animate-spin text-gray-400" />
            </div>
            <div v-else class="flex gap-2">
              <UInput
                :model-value="revealedKey"
                readonly
                class="flex-1 font-mono text-sm"
              />
              <UButton
                icon="i-lucide-copy"
                color="neutral"
                @click="copyToClipboard(revealedKey)"
              />
            </div>
          </div>

          <div v-if="!revealLoading" class="text-sm text-gray-600 dark:text-gray-400">
            <p class="font-medium mb-2">Usage Example:</p>
            <pre class="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg overflow-x-auto"><code>curl -H "Authorization: Bearer {{ revealedKey }}" \
  https://your-domain.com/api/v1/links</code></pre>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end">
          <UButton
            label="Close"
            color="neutral"
            @click="showRevealModal = false"
          />
        </div>
      </template>
    </UModal>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="showDeleteConfirm" title="Revoke API Key">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to revoke the API key <strong>{{ deletingKey?.name }}</strong>?
            This action cannot be undone and any applications using this key will lose access immediately.
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="showDeleteConfirm = false"
            :disabled="deleting"
          />
          <UButton
            label="Revoke API Key"
            color="error"
            @click="deleteApiKey"
            :loading="deleting"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
