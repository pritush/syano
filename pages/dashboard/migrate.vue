<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'dashboard-auth',
})

useHead({
  title: 'Data Operations | Syano Dashboard',
  meta: [
    { name: 'description', content: 'Import, export, backup, and restore your database.' }
  ],
})

type ExportResponse = {
  exported_at: string
  items: unknown[]
}

type DatabaseBackup = {
  version: string
  exported_at: string
  database: string
  tables: {
    links: { count: number; data: any[] }
    tags: { count: number; data: any[] }
    access_logs: { count: number; data: any[]; note?: string }
    site_settings: { count: number; data: any[] }
  }
  metadata: {
    total_links: number
    total_tags: number
    total_logs: number
    total_settings: number
  }
}

const api = useDashboardApi()
const toasts = useToasts()

// Links Import/Export
const importing = ref(false)
const exporting = ref(false)
const overwriteImport = ref(true)
const importJson = ref('')
const exportJson = ref('')

// Database Backup/Restore
const backingUp = ref(false)
const restoring = ref(false)
const backupJson = ref('')
const restoreJson = ref('')
const clearExisting = ref(false)
const restoreTables = ref({
  links: true,
  tags: true,
  access_logs: false,
  site_settings: true,
})

const statusMessage = ref('')
const errorMessage = ref('')

// Schema Checking
const schemaChecking = ref(true)
const schemaUpgrading = ref(false)
const schemaStatus = ref<{ upToDate: boolean; missing: string[]; error?: string } | null>(null)

async function checkSchema() {
  try {
    schemaStatus.value = await api.request<{ upToDate: boolean; missing: string[]; error?: string }>('/api/database/schema-check')
  } catch (e: any) {
    // Silent fail
  } finally {
    schemaChecking.value = false
  }
}

async function upgradeSchema() {
  schemaUpgrading.value = true
  statusMessage.value = ''
  errorMessage.value = ''
  
  try {
    const res = await api.request<{ success: boolean; message: string; error?: string }>('/api/database/upgrade', { method: 'POST' })
    if (res.success) {
      statusMessage.value = 'Database schema successfully upgraded to match latest version.'
      toasts.success('Upgrade completed', res.message)
      await checkSchema()
    } else {
      throw new Error(res.error)
    }
  } catch (error: any) {
    errorMessage.value = error?.message || error?.data?.statusMessage || 'Unable to run database migrations.'
    toasts.error('Upgrade failed', errorMessage.value)
  } finally {
    schemaUpgrading.value = false
  }
}

onMounted(() => {
  checkSchema()
})

async function exportLinks() {
  exporting.value = true
  statusMessage.value = ''
  errorMessage.value = ''

  try {
    const response = await api.exportLinks()
    exportJson.value = JSON.stringify(response.data, null, 2)
    statusMessage.value = `Exported ${response.data.count} links.`
    toasts.success('Links exported', `${response.data.count} links exported successfully`)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.data?.message || 'Unable to export links.'
    toasts.error('Export failed', errorMessage.value)
  } finally {
    exporting.value = false
  }
}

function normalizeImportItems(parsed: unknown) {
  if (Array.isArray(parsed)) {
    return parsed
  }

  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).items)) {
    return (parsed as any).items
  }

  throw new Error('Expected a JSON array or an object with an items array.')
}

async function importLinks() {
  if (!importJson.value.trim()) return
  
  importing.value = true
  statusMessage.value = ''
  errorMessage.value = ''

  try {
    const parsed = JSON.parse(importJson.value)
    const items = normalizeImportItems(parsed)

    const response = await api.importLinks({
      overwrite: overwriteImport.value,
      items,
    })

    statusMessage.value = `Successfully imported ${response.data.count} links.`
    toasts.success('Links imported', `${response.data.count} links imported successfully`)
    importJson.value = ''
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.data?.message || error?.message || 'Unable to import links. Check format.'
    toasts.error('Import failed', errorMessage.value)
  } finally {
    importing.value = false
  }
}

async function createDatabaseBackup() {
  backingUp.value = true
  statusMessage.value = ''
  errorMessage.value = ''

  try {
    const response = await api.request<DatabaseBackup>('/api/database/backup', {
      method: 'POST',
    })
    
    backupJson.value = JSON.stringify(response, null, 2)
    statusMessage.value = `Full database backup created: ${response.metadata.total_links} links, ${response.metadata.total_tags} tags, ${response.metadata.total_logs} logs`
    toasts.success('Backup created', 'Full database backup created successfully')
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Unable to create database backup.'
    toasts.error('Backup failed', errorMessage.value)
  } finally {
    backingUp.value = false
  }
}

async function restoreDatabase() {
  if (!restoreJson.value.trim()) return
  
  restoring.value = true
  statusMessage.value = ''
  errorMessage.value = ''

  try {
    const backup = JSON.parse(restoreJson.value)
    
    const response = await api.request<{ success: boolean; message: string; results: any }>('/api/database/restore', {
      method: 'POST',
      body: {
        backup,
        options: {
          clearExisting: clearExisting.value,
          restoreTables: restoreTables.value,
        },
      },
    })

    const { results } = response
    statusMessage.value = `Database restored: ${results.restored.links} links, ${results.restored.tags} tags, ${results.restored.site_settings} settings`
    
    if (results.errors.length > 0) {
      statusMessage.value += ` (${results.errors.length} errors)`
    }
    
    toasts.success('Database restored', response.message)
    restoreJson.value = ''
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Unable to restore database. Check format.'
    toasts.error('Restore failed', errorMessage.value)
  } finally {
    restoring.value = false
  }
}

function copyExport() {
  if (!exportJson.value) return
  navigator.clipboard.writeText(exportJson.value)
  toasts.copied('Export JSON')
}

function copyBackup() {
  if (!backupJson.value) return
  navigator.clipboard.writeText(backupJson.value)
  toasts.copied('Backup JSON')
}

function downloadBackup() {
  if (!backupJson.value) return
  
  const blob = new Blob([backupJson.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `syano-backup-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  toasts.success('Download started', 'Backup file is downloading')
}
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-col gap-2">
      <p class="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
        Data Operations
      </p>
      <h1 class="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
        Database Management
      </h1>
      <p class="text-slate-500 dark:text-slate-400">
        Import, export, backup, and restore your complete database or individual link collections.
      </p>
    </div>

    <!-- Status Messages -->
    <transition name="fade">
      <div v-if="statusMessage" class="flex items-center gap-3 rounded-[20px] bg-brand-50 p-4 text-brand-700 ring-1 ring-inset ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-400 dark:ring-brand-500/20">
        <UIcon name="lucide:check-circle-2" class="h-5 w-5 shrink-0" />
        <p class="font-medium">{{ statusMessage }}</p>
      </div>
      <div v-else-if="errorMessage" class="flex items-center gap-3 rounded-[20px] bg-red-50 p-4 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20">
        <UIcon name="lucide:alert-circle" class="h-5 w-5 shrink-0" />
        <p class="font-medium">{{ errorMessage }}</p>
      </div>
    </transition>

    <!-- Schema Upgrade Assistant -->
    <div v-if="!schemaChecking && schemaStatus?.upToDate === false" class="rounded-[24px] bg-brand-50 p-6 ring-1 ring-inset ring-brand-200 dark:bg-brand-900/10 dark:ring-brand-800/30">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <UIcon name="lucide:sparkles" class="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <h3 class="text-lg font-semibold text-brand-900 dark:text-brand-100">Database Update Available</h3>
          </div>
          <p class="text-sm text-brand-700 dark:text-brand-300">
            We detected that your PostgreSQL schema is missing some of the latest update structures.
          </p>
          <ul class="mt-3 list-inside list-disc text-sm text-brand-700 dark:text-brand-300">
            <li v-for="item in schemaStatus.missing" :key="item">{{ item }}</li>
          </ul>
        </div>
        <UButton :loading="schemaUpgrading" @click="upgradeSchema" color="primary" size="lg" icon="lucide:database-zap" class="shrink-0">
          Apply Database Update
        </UButton>
      </div>
    </div>
    <div v-else-if="!schemaChecking && schemaStatus?.upToDate === true" class="flex items-center gap-2 rounded-[20px] bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
      <UIcon name="lucide:check-circle-2" class="h-4 w-4" />
      Database schema is fully up to date. No updates required.
    </div>

    <!-- Full Database Backup/Restore -->
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <UIcon name="lucide:database" class="h-5 w-5 text-brand-500" />
        <h2 class="text-xl font-semibold text-slate-950 dark:text-white">
          Full Database Backup & Restore
        </h2>
      </div>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Complete database backup includes all links, tags, analytics logs, and site settings. Use this for full system backups and disaster recovery.
      </p>

      <div class="grid gap-8 xl:grid-cols-2 lg:items-start">
        <!-- Database Backup -->
        <UCard :ui="{ body: 'p-0 sm:p-0' }" class="sy-surface overflow-hidden flex flex-col rounded-[28px] border border-slate-200 shadow-sm dark:border-slate-800">
          <template #header>
            <div class="flex items-center justify-between p-6 pb-4">
              <div>
                <h3 class="flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-white">
                  <UIcon name="lucide:hard-drive-download" class="h-5 w-5 text-emerald-500" />
                  Create Full Backup
                </h3>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Export complete database snapshot
                </p>
              </div>
              <div class="flex gap-2">
                <UButton 
                  v-if="backupJson" 
                  color="neutral" 
                  variant="outline" 
                  size="sm"
                  icon="lucide:download"
                  @click="downloadBackup"
                >
                  Download
                </UButton>
                <UButton 
                  color="primary" 
                  variant="solid" 
                  :loading="backingUp" 
                  @click="createDatabaseBackup"
                >
                  Create Backup
                </UButton>
              </div>
            </div>
          </template>
          
          <div class="relative flex-1 bg-slate-50 dark:bg-slate-900">
            <UTextarea
              v-model="backupJson"
              :rows="16"
              :ui="{ root: 'w-full', base: 'font-mono text-sm border-0 focus:ring-0 resize-none h-[400px]' }"
              placeholder="Click 'Create Backup' to generate full database backup..."
              readonly
              variant="none"
            />
            <div v-if="backupJson" class="absolute bottom-6 right-6">
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="lucide:copy"
                class="shadow-sm"
                @click="copyBackup"
              >
                Copy
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Database Restore -->
        <UCard :ui="{ body: 'p-6 pt-4' }" class="sy-surface flex flex-col rounded-[28px] border border-slate-200 shadow-sm dark:border-slate-800">
          <template #header>
            <div class="p-6 pb-2">
              <h3 class="flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-white">
                <UIcon name="lucide:hard-drive-upload" class="h-5 w-5 text-amber-500" />
                Restore from Backup
              </h3>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Restore database from backup JSON
              </p>
            </div>
          </template>
          
          <div class="flex flex-col gap-5">
            <!-- Restore Options -->
            <div class="space-y-3">
              <div class="flex items-center gap-3 rounded-[20px] bg-red-50/80 p-4 ring-1 ring-inset ring-red-200 dark:bg-red-900/20 dark:ring-red-800/50">
                <UToggle v-model="clearExisting" color="error" />
                <div class="flex flex-col justify-center">
                  <span class="text-sm font-medium text-red-900 dark:text-red-200">Clear Existing Data</span>
                  <span class="text-xs text-red-700 dark:text-red-400 mt-0.5">⚠️ Delete all current data before restore (destructive)</span>
                </div>
              </div>

              <div class="rounded-[20px] bg-slate-50/80 p-4 ring-1 ring-inset ring-slate-200 dark:bg-slate-800/40 dark:ring-slate-700/50 space-y-3">
                <p class="text-sm font-medium text-slate-900 dark:text-slate-200">Tables to Restore:</p>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex items-center gap-2">
                    <UToggle v-model="restoreTables.links" color="brand" size="sm" />
                    <span class="text-sm text-slate-700 dark:text-slate-300">Links</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <UToggle v-model="restoreTables.tags" color="brand" size="sm" />
                    <span class="text-sm text-slate-700 dark:text-slate-300">Tags</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <UToggle v-model="restoreTables.access_logs" color="brand" size="sm" />
                    <span class="text-sm text-slate-700 dark:text-slate-300">Analytics</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <UToggle v-model="restoreTables.site_settings" color="brand" size="sm" />
                    <span class="text-sm text-slate-700 dark:text-slate-300">Settings</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="rounded-xl overflow-hidden ring-1 ring-inset ring-slate-200 focus-within:ring-2 focus-within:ring-brand-500 dark:ring-slate-700">
              <UTextarea
                v-model="restoreJson"
                :rows="10"
                variant="none"
                :ui="{ base: 'font-mono text-sm border-0 focus:ring-0 resize-none' }"
                placeholder="Paste your backup JSON here..."
              />
            </div>
          </div>
          
          <template #footer>
            <div class="flex justify-end p-6 pt-4">
              <UButton 
                color="error" 
                :loading="restoring" 
                :disabled="!restoreJson.trim()" 
                @click="restoreDatabase" 
                size="lg" 
                icon="lucide:alert-triangle"
              >
                Restore Database
              </UButton>
            </div>
          </template>
        </UCard>
      </div>
    </div>

    <!-- Divider -->
    <div class="relative">
      <div class="absolute inset-0 flex items-center" aria-hidden="true">
        <div class="w-full border-t border-slate-200 dark:border-slate-700" />
      </div>
      <div class="relative flex justify-center">
        <span class="bg-white px-4 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">Links Only</span>
      </div>
    </div>

    <!-- Links Import/Export -->
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <UIcon name="lucide:link-2" class="h-5 w-5 text-brand-500" />
        <h2 class="text-xl font-semibold text-slate-950 dark:text-white">
          Links Import & Export
        </h2>
      </div>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Export or import only your shortened links. Use this for selective data migration or sharing link collections.
      </p>

      <div class="grid gap-8 xl:grid-cols-2 lg:items-start">
        <!-- Export Section -->
        <UCard :ui="{ body: 'p-0 sm:p-0' }" class="sy-surface overflow-hidden flex flex-col rounded-[28px] border border-slate-200 shadow-sm dark:border-slate-800">
          <template #header>
            <div class="flex items-center justify-between p-6 pb-4">
              <div>
                <h3 class="flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-white">
                  <UIcon name="lucide:download-cloud" class="h-5 w-5 text-brand-500" />
                  Export Links
                </h3>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Generate a backup of all current links
                </p>
              </div>
              <UButton color="neutral" variant="outline" :loading="exporting" @click="exportLinks">
                Generate Export
              </UButton>
            </div>
          </template>
          
          <div class="relative flex-1 bg-slate-50 dark:bg-slate-900">
            <UTextarea
              v-model="exportJson"
              :rows="16"
              :ui="{ root: 'w-full', base: 'font-mono text-sm border-0 focus:ring-0 resize-none h-[400px]' }"
              placeholder="Click 'Generate Export' to fetch your links JSON..."
              readonly
              variant="none"
            />
            <div v-if="exportJson" class="absolute bottom-6 right-6">
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="lucide:copy"
                class="shadow-sm"
                @click="copyExport"
              >
                Copy
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Import Section -->
        <UCard :ui="{ body: 'p-6 pt-4' }" class="sy-surface flex flex-col rounded-[28px] border border-slate-200 shadow-sm dark:border-slate-800">
          <template #header>
            <div class="p-6 pb-2">
              <h3 class="flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-white">
                <UIcon name="lucide:upload-cloud" class="h-5 w-5 text-brand-500" />
                Import Links
              </h3>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Paste JSON contents to add links
              </p>
            </div>
          </template>
          
          <div class="flex flex-col gap-5">
            <div class="flex items-center gap-3 rounded-[20px] bg-slate-50/80 p-4 ring-1 ring-inset ring-slate-200 dark:bg-slate-800/40 dark:ring-slate-700/50">
              <UToggle v-model="overwriteImport" color="brand" />
              <div class="flex flex-col justify-center">
                <span class="text-sm font-medium text-slate-900 dark:text-slate-200">Overwrite Existing</span>
                <span class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Update items with matching slugs instead of skipping</span>
              </div>
            </div>
            
            <div class="rounded-xl overflow-hidden ring-1 ring-inset ring-slate-200 focus-within:ring-2 focus-within:ring-brand-500 dark:ring-slate-700">
              <UTextarea
                v-model="importJson"
                :rows="12"
                variant="none"
                :ui="{ base: 'font-mono text-sm border-0 focus:ring-0 resize-none' }"
                placeholder="Paste your exported JSON here..."
              />
            </div>
          </div>
          
          <template #footer>
            <div class="flex justify-end p-6 pt-4">
              <UButton :loading="importing" :disabled="!importJson.trim()" @click="importLinks" size="lg" icon="lucide:upload">
                Process Import
              </UButton>
            </div>
          </template>
        </UCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
