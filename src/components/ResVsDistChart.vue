<script setup lang="ts">
import type { ScatterOptions } from '@/lib/lichen/src/types'
import { QArrival } from '@/lib/sismojs/src/core/event/types'
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useAppStore } from '@/stores/app'
import Lichen from '@/lib/lichen/src'

const store = useAppStore()
const chartContainer = ref()
const chart = ref(null as Lichen | null)

function getColor(arrival: QArrival) {
  return arrival.timeWeight == 0
    ? 'grey'
    : arrival.pickID.referredObject.evaluationMode === 'manual'
      ? 'green'
      : 'red'
}

function drawChart() {
  if (store.currentArrivals == null || chartContainer.value == null) {
    return
  }
  chartContainer.value.innerHTML = ''
  const serieP: ScatterOptions = { name: 'P', color: 'black', shape: 'circle', data: [], tooltipFormatter: p => p.y.toFixed(2) }
  const serieS: ScatterOptions = { name: 'S', color: 'black', shape: 'diamond', data: [], tooltipFormatter: p => p.y.toFixed(2) }
  let max = 0
  for (const arrival of store.currentArrivals) {
    if (arrival.distance != null && arrival.timeResidual != null) {
      const serie = arrival.phase === 'P' ? serieP : serieS
      const color = getColor(arrival)
      serie.data.push({ x: arrival.distance, y: arrival.timeResidual, name: arrival.pickID.referredObject.waveformID.seedid || '-', color, extra: arrival.pickID.id })
      max = Math.max(max, Math.abs(arrival.timeResidual!))
    }
  }
  max = Math.max(1, max)
  if (chart.value != null) {
    chart.value.destroy()
  }
  const fontSize = store.settings['picker.tickFontSize']
  chart.value = new Lichen(chartContainer.value as HTMLElement, {
    header: { title: 'Time residual / Distance', position: 'top' },
    crosshair: { enabled: false },
    xAxis: { datetime: false, title: 'Distance [°]', min: 0, tooltipFormatter: x => x.toFixed(2), fontSize },
    yAxis: { min: -1.1 * max, max: 1.1 * max, title: 'Residual [s]', fontSize },
    legend: { enabled: false },
    height: 238,
    type: 'scatter',
    zoom: null,
    series: [ serieP, serieS ],
    hooks: { beforeSelection: handleChartSelection }
  })
}

function handleChartSelection(x: [number | null, number | null], y: [number | null, number | null]) {
  if (chart.value == null) {
    return false
  }
  const manualOnly = store.keydown.indexOf('ctrl+shift') === 0
  const series = chart.value.opt.series as ScatterOptions[]
  const result: QArrival[] = []
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
      const arrival = getArrival(point.extra) as QArrival
      if (inXRange && inYRange) {
        if (manualOnly) {
          if (arrival.pickID.referredObject.evaluationMode === 'manual') {
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

function getArrival(pickId: string) {
  return store.currentArrivals!.find(x => x.pickID.id === pickId)
}

watch(() => store.currentArrivals, drawChart)

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