<script setup lang="ts">
const props = defineProps<{
  items: Array<{ day: string; views: number }>
}>()

const maxViews = computed(() => {
  return Math.max(1, ...props.items.map((item) => item.views))
})
</script>

<template>
  <div class="space-y-4">
    <div v-if="items.length" class="flex h-56 items-end gap-2">
      <div
        v-for="item in items"
        :key="item.day"
        class="flex min-w-0 flex-1 flex-col items-center gap-2"
      >
        <span class="text-xs font-semibold text-slate-500">
          {{ item.views }}
        </span>
        <div class="flex h-40 w-full items-end rounded-t-[20px] bg-slate-100 px-1">
          <div
            class="w-full rounded-t-[18px] bg-brand-500 transition-all"
            :style="{ height: `${Math.max(8, Math.round((item.views / maxViews) * 100))}%` }"
          />
        </div>
        <span class="text-center text-[11px] font-medium text-slate-500">
          {{ item.day.slice(5) }}
        </span>
      </div>
    </div>

    <div v-else class="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
      No view data for the selected range yet.
    </div>
  </div>
</template>

