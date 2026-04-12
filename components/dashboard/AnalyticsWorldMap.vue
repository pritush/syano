<script setup lang="ts">
import * as d3 from 'd3-geo'
import * as topojson from 'topojson-client'

const props = defineProps<{
  items: Array<{
    country: string
    region: string
    city: string
    latitude: number | null
    longitude: number | null
    views: number
  }>
}>()

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const width = 900
const height = 450
const geoData = ref<any>(null)
const loading = ref(true)

const countryCentroids: Record<string, [number, number]> = {
  US: [37.0902, -95.7129],
  GB: [55.3781, -3.436],
  CA: [56.1304, -106.3468],
  AU: [-25.2744, 133.7751],
  IN: [20.5937, 78.9629],
  DE: [51.1657, 10.4515],
  FR: [46.2276, 2.2137],
  JP: [36.2048, 138.2529],
  BR: [-14.235, -51.9253],
  SG: [1.3521, 103.8198],
  NP: [28.3949, 84.124],
}

const projection = d3.geoNaturalEarth1()
  .scale(160)
  .translate([width / 2, height / 2 + 20])

const pathGenerator = d3.geoPath().projection(projection)

const plottedPoints = computed(() => {
  const grouped = new Map<string, { x: number; y: number; views: number; label: string }>()

  props.items.forEach((item) => {
    if (!item.country || item.country === 'unknown') {
      return
    }

    let lat = item.latitude
    let lon = item.longitude

    if (lat === null || lon === null) {
      const centroid = countryCentroids[item.country]
      if (centroid) {
        lat = centroid[0]
        lon = centroid[1]
      }
    }

    if (lat === null || lon === null) {
      return
    }

    const projected = projection([lon, lat])
    if (!projected) {
      return
    }

    const [x, y] = projected
    const key = `${Math.round(x)}:${Math.round(y)}`
    const existing = grouped.get(key)

    if (existing) {
      existing.views += item.views
      return
    }

    grouped.set(key, {
      x,
      y,
      views: item.views,
      label: `${item.city || 'Unknown city'}, ${item.country}`,
    })
  })

  return Array.from(grouped.values())
})

const maxPointViews = computed(() => {
  return Math.max(1, ...plottedPoints.value.map((point) => point.views))
})

function markerRadius(views: number) {
  return 3 + Math.round((views / maxPointViews.value) * 10)
}

onMounted(async () => {
  try {
    const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
    const topology = await response.json()
    geoData.value = topojson.feature(topology, topology.objects.countries as any)
  } catch (error) {
    console.error('Failed to load map data:', error)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="relative overflow-hidden rounded-[28px] border p-4 transition-colors"
    :class="isDark 
      ? 'border-slate-800 bg-slate-950/95' 
      : 'border-slate-200 bg-slate-50'">
    <div v-if="loading" class="flex h-[450px] items-center justify-center">
      <div class="flex flex-col items-center gap-3">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
        <p class="text-sm font-medium text-slate-400">Loading global map...</p>
      </div>
    </div>

    <svg v-else :viewBox="`0 0 ${width} ${height}`" class="h-auto w-full">
      <!-- Background / Sea -->
      <rect :width="width" :height="height" fill="transparent" />
      
      <!-- Graticules (Grid lines) -->
      <g :opacity="isDark ? 0.05 : 0.1" :stroke="isDark ? '#94a3b8' : '#cbd5e1'" stroke-width="0.5">
        <path v-for="lat in [-60, -30, 0, 30, 60]" :key="`lat-${lat}`" :d="pathGenerator({ type: 'LineString', coordinates: [[-180, lat], [180, lat]] }) || ''" fill="none" />
        <path v-for="lon in [-120, -60, 0, 60, 120]" :key="`lon-${lon}`" :d="pathGenerator({ type: 'LineString', coordinates: [[lon, -90], [lon, 90]] }) || ''" fill="none" />
      </g>

      <g v-if="geoData">
        <path
          v-for="(feature, index) in geoData.features"
          :key="index"
          :d="pathGenerator(feature) || ''"
          :fill="isDark ? '#1e293b' : '#e2e8f0'"
          :stroke="isDark ? '#0f172a' : '#cbd5e1'"
          stroke-width="0.5"
          :class="isDark ? 'transition-colors hover:fill-slate-700' : 'transition-colors hover:fill-slate-300'"
        />
      </g>

      <g>
        <circle
          v-for="(point, index) in plottedPoints"
          :key="index"
          :cx="point.x"
          :cy="point.y"
          :r="markerRadius(point.views)"
          :fill="isDark ? '#5eead4' : '#14b8a6'"
          :fill-opacity="isDark ? 0.6 : 0.4"
          class="pulse-animation"
        >
          <title>{{ point.label }} | {{ point.views }} views</title>
        </circle>
        <circle
          v-for="(point, index) in plottedPoints"
          :key="`inner-${index}`"
          :cx="point.x"
          :cy="point.y"
          r="2.5"
          :fill="isDark ? '#ccfbf1' : '#0d9488'"
          :stroke="isDark ? '#14b8a6' : '#0f766e'"
          stroke-width="1.5"
        />
      </g>
    </svg>
    <div class="absolute bottom-6 left-6 rounded-xl p-3 text-[10px] backdrop-blur-md transition-colors"
      :class="isDark 
        ? 'bg-slate-900/80 text-slate-400' 
        : 'bg-white/80 text-slate-600'">
      <div class="flex items-center gap-2">
        <div class="h-2 w-2 rounded-full bg-brand-400"></div>
        <span>High traffic zones</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pulse-animation {
  animation: pulse 2s infinite ease-in-out;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(2.5); opacity: 0; }
}

circle.pulse-animation {
  transform-origin: center;
  transform-box: fill-box;
  pointer-events: none;
  vector-effect: non-scaling-stroke;
}
</style>
