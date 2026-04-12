<script setup lang="ts">
const props = defineProps<{
  items: Array<{ day_of_week: number; hour: number; views: number }>
}>()

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const maxViews = computed(() => {
  return Math.max(1, ...props.items.map((item) => item.views))
})

function cellViews(day: number, hour: number) {
  return props.items.find((item) => Number(item.day_of_week) === day && Number(item.hour) === hour)?.views || 0
}

function cellClass(value: number) {
  if (!value) return 'bg-slate-100'

  const intensity = value / maxViews.value
  if (intensity > 0.75) return 'bg-brand-700'
  if (intensity > 0.5) return 'bg-brand-500'
  if (intensity > 0.25) return 'bg-brand-300'
  return 'bg-brand-100'
}
</script>

<template>
  <div class="space-y-3 overflow-x-auto">
    <div class="grid min-w-[720px] grid-cols-[72px_repeat(24,minmax(0,1fr))] gap-2">
      <div />
      <div
        v-for="hour in 24"
        :key="`hour-${hour}`"
        class="text-center text-[11px] font-semibold text-slate-500"
      >
        {{ hour - 1 }}
      </div>

      <template v-for="(day, index) in weekdays" :key="day">
        <div class="flex items-center text-xs font-semibold text-slate-500">
          {{ day }}
        </div>
        <div
          v-for="hour in 24"
          :key="`${day}-${hour}`"
          class="h-6 rounded-md"
          :class="cellClass(cellViews(index, hour - 1))"
          :title="`${day} ${hour - 1}:00 - ${cellViews(index, hour - 1)} views`"
        />
      </template>
    </div>
  </div>
</template>

