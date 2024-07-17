<script setup lang="ts">
import type { ScatterOptions } from '@/lib/lichen/src/types'
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useAppStore } from '@/stores/app'
import DataUtils from '@/lib/lichen/src/dataUtils'
import Lichen from '@/lib/lichen/src'

const store = useAppStore()
const chartContainer = ref()
const chart = ref(null as Lichen | null)


function drawChart() {
  if (store.currentArrivals == null || store.currentEvent == null || store.currentOrigin == null || chartContainer.value == null) {
    return
  }
  chartContainer.value.innerHTML = ''
  const colorScale = {
    min: 0,
    max: store.currentOriginMagnitudes.length - 1,
    stops: Lichen.getColorScale('PARULA'),
    logarithmic: false
  }
  const magMap: Record<string, any> = {}
  const magColor: Record<string, string> = {}
  for (const [index, mag] of store.currentOriginMagnitudes.entries()) {
    if (mag.stationMagnitudeContribution == null) {
      console.log(`skip magnitude type ${mag.type}`)
      continue
    }
    magMap[mag.type] = []
    magColor[mag.type] = DataUtils.getColor(index, colorScale) as string
    for (const smc of mag.stationMagnitudeContribution) {
      const staMag = smc.stationMagnitudeID.referredObject
      if (staMag == null) {
        continue
      }
      const pick = staMag.amplitudeID.referredObject.pickID.referredObject
      const arrival = store.currentArrivals.find(a => a.pickID.id === pick.publicID)
      if (arrival == null) {
        console.warn(`Failed to retreive corresponding arrival for station magnitude of channel ${staMag.waveformID.seedid}`)
        continue
      }
      const [r, g, b] = DataUtils.getColor(index, colorScale, false) as number[]
      const a = Math.max(0.2, smc.weight != null ? smc.weight : 0)
      const color = `rgba(${r},${g},${b},${a})`
      magMap[mag.type].push({
        x: arrival.distance,
        y: staMag.mag.value,
        name: staMag.waveformID.seedid,
        color
      })
    }
  }
  if (chart.value != null) {
    chart.value.destroy()
  }
  const series: ScatterOptions[] = []
  for (const [name, data] of Object.entries(magMap)) {
    series.push({ name, shape: 'circle', data, color: magColor[name], tooltipFormatter: v => v.toFixed(2) })
  }
  chart.value = new Lichen(chartContainer.value as HTMLElement, {
    header: { title: 'Magnitude / Distance', position: 'top' },
    crosshair: { enabled: false },
    legend: { enabled: true, position: 'right' },
    xAxis: { datetime: false, title: 'Distance [°]', min: 0, tooltipFormatter: x => x.toFixed(2) },
    yAxis: { title: 'Magnitude' },
    height: 238,
    type: 'scatter',
    zoom: null,
    series
  })
}

watch(() => store.currentOriginMagnitudes, drawChart)

onMounted(drawChart)

onBeforeUnmount(() => {
  if (chart.value != null) {
    chart.value.destroy()
  }
})
</script>

<template>
  <div ref="chartContainer"></div>
</template>