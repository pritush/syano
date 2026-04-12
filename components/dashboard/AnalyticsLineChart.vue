<script setup lang="ts">
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const props = defineProps<{
  items: Array<{ day: string; views: number }>
}>()

const chartData = computed(() => {
  const sortedItems = [...props.items].sort((a, b) =>
    new Date(a.day).getTime() - new Date(b.day).getTime()
  )

  return {
    labels: sortedItems.map(item => {
      const date = new Date(item.day)
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }),
    datasets: [
      {
        label: 'Views',
        data: sortedItems.map(item => item.views),
        fill: true,
        backgroundColor: 'rgba(20, 115, 109, 0.1)',
        borderColor: 'rgba(20, 115, 109, 1)',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: 'rgba(20, 115, 109, 1)',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: 'rgba(20, 115, 109, 1)',
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index' as const,
  },
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleColor: '#f8fafc',
      bodyColor: '#cbd5e1',
      padding: 12,
      cornerRadius: 8,
      displayColors: false,
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: '#94a3b8',
        font: {
          size: 10,
        },
        maxRotation: 0,
      },
    },
    y: {
      grid: {
        color: 'rgba(148, 163, 184, 0.1)',
      },
      ticks: {
        color: '#94a3b8',
        font: {
          size: 11,
        },
        padding: 8,
      },
      beginAtZero: true,
    },
  },
}
</script>

<template>
  <div class="h-full">
    <div v-if="items.length" class="h-64">
      <Line :data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="flex h-64 items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
      No view data for the selected range yet.
    </div>
  </div>
</template>
