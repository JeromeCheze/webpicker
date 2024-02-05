<script setup lang="ts">
import type { FilterOptions, PickMap, StationRefTimes, ChartData } from '@/types'
import type { Trace } from '@/lib/sismojs/src/core/waveform'
import type { VLine } from '@/lib/lichen/src/types'
import type { Pick } from '@/lib/sismojs/src/types'
import { toNetSta, applyFilter } from '@/utils'
import { ref, watch, computed } from 'vue'
import { useAppStore } from '@/stores/app'
import Lichen from '@/lib/lichen/src'

const REDRAW = 0b001
const UPDATE_VLINES = 0b010
const UPDATE_CROSSHAIR = 0b100

const emit = defineEmits(['activeChannel', 'createPick', 'update:start', 'update:end', 'selectPicks', 'pickerTime'])

const store = useAppStore()

const props = defineProps<{
  activeStation: string | null
  pickMap: PickMap
  filter: FilterOptions | null
  phase: 'P' | 'S' | undefined
  data: Trace[]
  refTimeKey: string
  stationRefTimes: StationRefTimes
  stationDistance: Record<string,number>
}>()

const container = ref()
const start = ref(-2e3)
const end = ref(10e3)
const charts: Record<number, Lichen> = {}
let chartData: Record<string, ChartData> = {}

const pickerData = computed(() => {
  const result: Trace[] = []
  if (props.activeStation != null) {
    for (const tr of props.data) {
      if (tr.stats.id.startsWith(props.activeStation)) {
        result.push(tr)
      }
    }
  }
  return result
})

const distance = computed(() => {
  const value = props.stationDistance[props.activeStation!]
  if (value != null) {
    return (value / 1000).toFixed(1)
  }
  return ''
})

function getRefTime(seedid: string) {
  const netsta = toNetSta(seedid)
  return props.stationRefTimes[netsta][props.refTimeKey]
}

function getXRange(seedid: string) {
  const refTime = getRefTime(seedid)
  return [refTime + start.value, refTime + end.value]
}

function updateTimeWindow(seedid: string, t1: number, t2: number) {
  const refTime = getRefTime(seedid)
  start.value = t1 - refTime
  end.value = t2 - refTime
}

function getVLines(index: number, seedid: string) {
  const netsta = toNetSta(seedid)
  const result: VLine[] = [
    {
      color: 'red',
      x: props.stationRefTimes[netsta].O
    },
    {
      color: 'blue',
      x: props.stationRefTimes[netsta].P,
      text: index === pickerData.value.length - 1 ? 'P' : undefined,
      position: 'bottom'
    },
    {
      color: 'blue',
      x: props.stationRefTimes[netsta].S,
      text: index === pickerData.value.length - 1 ? 'S' : undefined,
      position: 'bottom'
    }
  ]
  if (props.pickMap[netsta] != null && props.pickMap[netsta][seedid] != null) {
    for (const p of props.pickMap[netsta][seedid]) {
      result.push({
        arrow: p.polarity === 'positive' ? 'top' : p.polarity === 'negative' ? 'bottom' : undefined,
        color: p.evaluation_mode === 'manual' ? 'green' : 'red',
        text: p.phase_hint,
        position: 'top',
        selectable: true,
        x: p.time._value!.getTime(),
        data: p.public_id
      })
    }
  }
  return result
}

function handleVlineSelection(vlines: VLine[]) {
  emit('selectPicks', vlines.map(x => x.data))
}

function getSerie(tr: Trace) {
  let values = tr.data
  if (props.filter != null) {
    values = applyFilter(props.filter, tr.stats.samplingRate, values)
  }
  return {
    start: tr.stats.starttime!,
    step: 1000 / tr.stats.samplingRate,
    data: values,
    color: store.settings.COLOR.WAVEFORM,
    enabled: true
  }
}

function createChart(index: number, chartContainer: HTMLElement, seedid: string, tr: Trace) {
  const result = new Lichen(chartContainer, {
    header: { title: seedid.split('.').slice(2, 4).join('.'), position: 'left', width: 100 },
    legend: { enabled: false },
    crosshair: { enabled: props.phase != null, text: index === 0 ? props.phase : '', sticky: false },
    synced: () => charts,
    xAxis: { enabled: index === pickerData.value.length -1 },
    selection: null,
    tooltip: false,
    type: 'line',
    height: 120,
    vLines: getVLines(index, seedid),
    series: [getSerie(tr)],
    hooks: {
      beforeResetDisplay: () => false,
      beforeUpdate: (chart: Lichen) => {
        const dataUtils = chart.dataUtils
        if (props.activeStation != null) {
          updateTimeWindow(props.activeStation!, dataUtils.start!, dataUtils.end!)
          const [yMin, yMax] = [dataUtils.yMin, dataUtils.yMax]
          if (yMin != null && yMax != null && dataUtils.computed.series != null && dataUtils.computed.series[0] != null) {
            const halfAmplitude = (yMax - yMin) / 2
            chart.dataUtils.yMin = dataUtils.computed.series[0].avgValue - halfAmplitude
            chart.dataUtils.yMax = dataUtils.computed.series[0].avgValue + halfAmplitude
            return true
          }
        }
        return false
      },
      onCursorMove: (x: number, y: number) => emit('pickerTime', x),
      onVlineSelection: handleVlineSelection,
      onDblClick: (t: number) => emit('createPick', t),
      onActive: (chart: Lichen) => emit('activeChannel', `${props.activeStation}.${chart.opt.header.title}`)
    }
  }, false)
  return result
}

function update(actionBitMap = 0) {
  for (const [index, tr] of pickerData.value.entries()) {
    if (chartData[tr.stats.id] == null) {
      // Force redraw if not all charts already created
      actionBitMap |= REDRAW
    }
  }
  for (const [index, tr] of pickerData.value.entries()) {
    if (chartData[tr.stats.id] == null) {
      const div = document.createElement('div')
      container.value.appendChild(div)
      const chart = createChart(index, div, tr.stats.id, tr)
      chartData[tr.stats.id] = { index, chart, container: div }
      const [x1, x2] = getXRange(tr.stats.id)
      chart.setXRange(x1, x2)
    } else {
      chartData[tr.stats.id].index = index
      const chart = chartData[tr.stats.id].chart
      if (actionBitMap & UPDATE_VLINES) {
        chart.opt.vLines = getVLines(index, tr.stats.id)
        chart.frontPanel.update(null)
      }
      if (actionBitMap & UPDATE_CROSSHAIR) {
        chart.opt.crosshair!.enabled = props.phase != null
        chart.opt.crosshair!.text = index === 0 ? props.phase : ''
      }
      if (actionBitMap & REDRAW) {
        chart.opt.xAxis!.enabled = index === pickerData.value.length -1
        chart.opt.series = [getSerie(tr)]
        chart.setYRange(null, null)
      }
    }
  }
}

function reset() {
  for (const current of Object.values(chartData)) {
    current.chart.destroy()
    current.container.remove()
  }
  chartData = {}
}

watch(() => props.filter, () => update(REDRAW))

watch(() => props.phase, () => update(UPDATE_CROSSHAIR))

watch(() => props.pickMap, () => update(UPDATE_VLINES))

watch(() => props.refTimeKey, () => {
  for (const current of Object.values(chartData)) {
    const [t1, t2] = getXRange(props.activeStation!)
    current.chart.setXRange(t1, t2)
  }
})

watch(() => props.data, () => {
  if (container.value == null) {
    return
  }
  update()
  const sorted = document.createDocumentFragment()
  for (const tr of pickerData.value) {
    sorted.appendChild(chartData[tr.stats.id].container)
  }
  container.value.appendChild(sorted)
})

watch(() => props.activeStation, (value) => {
  if (value == null) {
    return
  }
  reset()
  update()
}, { immediate: true })
</script>

<template>
  <div>{{ props.activeStation }} <span class="text-caption">- {{ distance }} km</span></div>
  <div ref="container"></div>
</template>