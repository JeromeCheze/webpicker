<script setup lang="ts">
import type { ScatterOptions } from '@/lib/lichen/src/types'
import type { Arrival } from '@/lib/sismojs/src/core/event/types'
import { ref, watch, onBeforeUnmount, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import Lichen from '@/lib/lichen/src'

const store = useAppStore()
const chartContainer = ref()
const chart = ref(null as Lichen | null)

function getColor(arrival: Arrival) {
  return arrival.timeWeight == 0
    ? 'grey'
    : arrival.pickID.referredObject.evaluationMode === 'automatic'
      ? 'red'
      : 'green'
}

function traveltime(a: Arrival) {
  if (store.currentOrigin == null) {
    return null
  }
  return (a.pickID.referredObject.time.object - store.currentOrigin.time.object) / 1e3
}

function drawChart() {
  if (store.currentArrivals == null || chartContainer.value == null) {
    return
  }
  chartContainer.value.innerHTML = ''
  const serieP: ScatterOptions = { name: 'P', color: 'black', shape: 'circle', data: [], tooltipFormatter: v => v.toFixed(2) }
  const serieS: ScatterOptions = { name: 'S', color: 'black', shape: 'diamond', data: [], tooltipFormatter: v => v.toFixed(2) }
  let max = 0
  for (const arrival of store.currentArrivals) {
    const serie = arrival.phase === 'P' ? serieP : serieS
    const color = getColor(arrival)
    const tt = traveltime(arrival)
    if (tt != null && arrival.distance != null) {
      serie.data.push({ x: arrival.distance, y: tt, name: arrival.pickID.referredObject.waveformID.seedid || '-', color, extra: arrival.pickID.id })
      max = Math.max(max, tt)
    }
  }
  if (chart.value != null) {
    chart.value.destroy()
  }
  chart.value = new Lichen(chartContainer.value as HTMLElement, {
    header: { title: 'Traveltime', position: 'top' },
    crosshair: { enabled: false },
    xAxis: { datetime: false, title: 'Distance [°]', min: 0, tooltipFormatter: x => x.toFixed(2) },
    yAxis: { min: 0, max: 1.1 * max, title: 'Traveltime [s]' },
    legend: { enabled: false },
    height: 238,
    type: 'scatter',
    series: [ serieP, serieS ],
    hooks: { beforeSelection: handleChartSelection }
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
      const arrival = getArrival(point.extra) as Arrival
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