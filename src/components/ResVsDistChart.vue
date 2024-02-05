<script setup lang="ts">
import type { ScatterOptions } from '@/lib/lichen/src/types'
import type { Arrival } from '@/lib/sismojs/src/types'
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useAppStore } from '@/stores/app'
import Lichen from '@/lib/lichen/src'

const store = useAppStore()
const chartContainer = ref()
const chart = ref(null as Lichen | null)

function getColor(arrival: Arrival) {
  return arrival.time_weight == 0
    ? 'grey'
    : arrival._pick?.evaluation_mode === 'automatic'
      ? 'red'
      : 'green'
}

function drawChart() {
  if (store.currentArrivals == null || chartContainer.value == null) {
    return
  }
  chartContainer.value.innerHTML = ''
  const serieP: ScatterOptions = { name: 'P', color: 'lime', shape: 'circle', data: [], tooltipFormatter: v => v.toFixed(2) }
  const serieS: ScatterOptions = { name: 'S', color: 'red', shape: 'diamond', data: [], tooltipFormatter: v => v.toFixed(2) }
  let max = 0
  for (const arrival of store.currentArrivals) {
    const serie = arrival.phase === 'P' ? serieP : serieS
    const color = getColor(arrival)
    serie.data.push({ x: arrival.distance, y: arrival.time_residual, name: arrival._pick?._seedid || '-', color, extra: arrival })
    max = Math.max(max, Math.abs(arrival.time_residual))
  }
  if (chart.value != null) {
    chart.value.destroy()
  }
  chart.value = new Lichen(chartContainer.value as HTMLElement, {
    header: { title: 'Time residual / Distance', position: 'top' },
    crosshair: { enabled: false },
    xAxis: { datetime: false, title: 'Distance [°]', min: 0, tooltipFormatter: x => x.toFixed(2) },
    yAxis: { min: -1.1 * max, max: 1.1 * max, title: 'Residual [s]' },
    height: 238,
    type: 'scatter',
    series: [ serieP, serieS ],
    hooks: {
      beforeSelection: handleChartSelection,
      beforeUpdate: (chart) => {
        const dataUtils = chart.dataUtils
        const [yMin, yMax] = [dataUtils.yMin, dataUtils.yMax]
        if (yMin != null && yMax != null && dataUtils.computed.series != null && dataUtils.computed.series[0] != null) {
          const halfAmplitude = (yMax - yMin) / 2
          chart.dataUtils.yMin = dataUtils.computed.series[0].avgValue - halfAmplitude
          chart.dataUtils.yMax = dataUtils.computed.series[0].avgValue + halfAmplitude
          return true
        }
        return true
      }
    }
  })
}

function handleChartSelection(x: [number | null, number | null], y: [number | null, number | null]) {
  if (chart.value == null) {
    return false
  }
  const manualOnly = store.keydown === 'shift+shift'
  const series = chart.value.opt.series as ScatterOptions[]
  const result: Arrival[] = []
  for (const serie of series) {
    for (const point of serie.data) {
      const inXRange = x[0] == null && x[1] == null
        ? true
        : x[0] != null && x[1] != null && point.x >= x[0] && point.x <= x[1]
          ? true
          : false
      const inYRange = y[0] == null && y[1] == null
        ? true
        : y[0] != null && y[1] != null && point.y >= y[0] && point.y <= y[1]
          ? true
          : false
      const arrival = point.extra as Arrival
      if (inXRange && inYRange) {
        if (manualOnly) {
          if (arrival._pick?.evaluation_mode === 'manual') {
            result.push(arrival)
          }
        } else {
          result.push(arrival)
        }
      }
    }
  }
  store.selectArrivals(result)
  return false
}

watch(() => store.currentArrivals, () => {
  drawChart()
})

onMounted(() => {
  drawChart()
})

onBeforeUnmount(() => {
  if (chart.value != null) {
    chart.value.destroy()
  }
})
</script>

<template>
  <div ref="chartContainer"></div>
</template>