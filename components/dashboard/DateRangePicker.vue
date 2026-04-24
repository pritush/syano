<script setup lang="ts">
import { subDays, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, format } from 'date-fns'
import { DatePicker as VDatePicker } from 'v-calendar'
import 'v-calendar/dist/style.css'

const props = defineProps<{
  modelValue: { start: Date; end: Date } | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: { start: Date; end: Date } | null]
}>()

const range = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const isOpen = ref(false)

const predefinedRanges = [
  { label: 'Last 24 hours', getRange: () => ({ start: subDays(new Date(), 1), end: new Date() }) },
  { label: 'Last 7 days', getRange: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
  { label: 'Last 30 days', getRange: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
  { label: 'Last 3 months', getRange: () => ({ start: subMonths(new Date(), 3), end: new Date() }) },
  { label: 'Last 12 months', getRange: () => ({ start: subMonths(new Date(), 12), end: new Date() }) },
  { label: 'Month to Date', getRange: () => ({ start: startOfMonth(new Date()), end: new Date() }) },
  { label: 'Quarter to Date', getRange: () => ({ start: startOfQuarter(new Date()), end: new Date() }) },
  { label: 'Year to Date', getRange: () => ({ start: startOfYear(new Date()), end: new Date() }) },
  { label: 'All Time', getRange: () => ({ start: new Date('2020-01-01'), end: new Date() }) },
]

function selectRange(getRange: () => { start: Date; end: Date }) {
  range.value = getRange()
  isOpen.value = false
}

const displayValue = computed(() => {
  if (!range.value) return 'Select date range'
  
  const { start, end } = range.value
  
  // Try to match with predefined ranges to show label instead of dates
  for (const preset of predefinedRanges) {
    const presetRange = preset.getRange()
    if (format(start, 'yyyy-MM-dd') === format(presetRange.start, 'yyyy-MM-dd') && 
        format(end, 'yyyy-MM-dd') === format(presetRange.end, 'yyyy-MM-dd')) {
      return preset.label
    }
  }

  return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`
})
</script>

<template>
  <UPopover v-model:open="isOpen" :popper="{ placement: 'bottom-start' }">
    <UButton
      color="neutral"
      variant="outline"
      icon="lucide:calendar"
      class="w-full justify-start rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 hover:border-brand-300 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-brand-600 font-normal"
    >
      {{ displayValue }}
    </UButton>

    <template #content="{ close }">
      <div class="flex flex-col sm:flex-row bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-xl border border-slate-200 dark:border-slate-800">
        <!-- Calendar Section -->
        <div class="p-2 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-slate-800">
          <ClientOnly>
            <VDatePicker 
              v-model.range="range" 
              :columns="2" 
              color="teal"
              borderless 
              transparent
            />
          </ClientOnly>
        </div>

        <!-- Shortcuts Section -->
        <div class="w-full sm:w-48 bg-slate-50 dark:bg-slate-800/50 flex flex-col p-2 space-y-1">
          <button
            v-for="preset in predefinedRanges"
            :key="preset.label"
            class="text-left px-4 py-2 text-sm rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            :class="{
              'font-semibold text-slate-900 dark:text-white': displayValue === preset.label,
              'text-slate-600 dark:text-slate-300': displayValue !== preset.label
            }"
            @click="selectRange(preset.getRange)"
          >
            {{ preset.label }}
          </button>
        </div>
      </div>
    </template>
  </UPopover>
</template>

<style>
/* Map VCalendar accent colors to our existing design system's brand colors */
.vc-container {
  --vc-accent-50: var(--color-brand-50) !important;
  --vc-accent-100: var(--color-brand-100) !important;
  --vc-accent-200: var(--color-brand-200) !important;
  --vc-accent-300: var(--color-brand-300) !important;
  --vc-accent-400: var(--color-brand-400) !important;
  --vc-accent-500: var(--color-brand-500) !important;
  --vc-accent-600: var(--color-brand-600) !important;
  --vc-accent-700: var(--color-brand-700) !important;
  --vc-accent-800: var(--color-brand-800) !important;
  --vc-accent-900: var(--color-brand-900) !important;
  
  --vc-font-family: var(--font-sans) !important;
  font-family: var(--font-sans) !important;
}

/* Adjust VCalendar for dark mode to blend seamlessly */
.dark .vc-container {
  --vc-bg: transparent;
  --vc-border: transparent;
  --vc-text-color: #f1f5f9;
  --vc-header-title-color: #f8fafc;
  --vc-header-arrow-color: #94a3b8;
  --vc-header-arrow-hover-bg: #334155;
  --vc-nav-title-color: #f8fafc;
  --vc-nav-item-text-color: #cbd5e1;
  --vc-nav-item-active-bg: var(--color-brand-500);
  --vc-nav-item-active-color: #ffffff;
  --vc-nav-item-hover-bg: #334155;
  --vc-popover-content-bg: #1e293b;
  --vc-popover-content-border: #334155;
}
</style>
