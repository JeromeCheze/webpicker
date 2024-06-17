<script setup lang="ts">
import type { FilterOptions, PickerToolbarOptions, StationRefTimes, ChartData, WaveformProcessInterface } from '@/types'
import type { LineOptions, VLine } from '@/lib/lichen/src/types'
import type { Pick } from '@/lib/sismojs/src/core/event/types'
import type { Trace } from '@/lib/sismojs/src/core/waveform'
import { FilterProcessor } from '@/utils/waveformProcessor'
import { ref, watch, computed, onMounted } from 'vue'
import { getDefault, toNetSta } from '@/utils'
import { useAppStore } from '@/stores/app'
import Lichen from '@/lib/lichen/src'

const emit = defineEmits(['selectStation', 'update:start', 'update:end'])

const store = useAppStore()

const props = defineProps<{
  data: Trace[]
  sortTrace: PickerToolbarOptions['sort']
  filter: FilterOptions | null
  refTimeKey: string
  stationRefTimes: StationRefTimes
}>()

const container = ref()
const start = ref(-2e3)
const end = ref(10e3)
const charts: Record<number, Lichen> = {}
let chartData: Record<string, ChartData> = {}
const selected = ref(null as string | null)
const initialized = ref(false)
const filterProcessor = new FilterProcessor()

const listData = computed(() => {
  const result: WaveformProcessInterface[] = []
  const netstaTrace: Record<string, Trace[]> = {}
  for (const tr of props.data) {
    const netsta = `${tr.stats.network}.${tr.stats.station}`
    getDefault(netstaTrace, netsta, []).push(tr)
  }
  const netstaList = Object.keys(netstaTrace)
  if (props.sortTrace === 'distance') {
    netstaList.sort((a, b) => {
      const aa = store.dataManager.getStationDistance(a)
      const bb = store.dataManager.getStationDistance(b)
      return aa < bb ? -1 : aa > bb ? 1 : 0
    })
  } else {
    netstaList.sort()
  }
  for (const netsta of netstaList) {
    let tr = netstaTrace[netsta].find(tr => tr.stats.channel.indexOf('Z') === 2)
    if (tr == null) {
      tr = netstaTrace[netsta][0]
    }
    result.push({
      id: tr.stats.id,
      start: tr.stats.starttime as number,
      step: 1e3 / tr.stats.samplingRate,
      values: tr.data
    })
  }
  return result
})

async function processWaveforms() {
  return await filterProcessor.setEnable(props.filter != null).setFilterParams(props.filter).process(listData.value)
}

function getRefTime(seedid: string) {
  return props.stationRefTimes[toNetSta(seedid)][props.refTimeKey]
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

function getVLines(netsta: string) {
  const result: VLine[] = [
    { color: store.settings['color.TTT'], x: props.stationRefTimes[netsta].P, text: 'P', position: 'bottom' },
    { color: store.settings['color.TTT'], x: props.stationRefTimes[netsta].S, text: 'S', position: 'bottom' },
    { color: store.settings['color.T0'], x: props.stationRefTimes[netsta].O }
  ]
  // if (props.stationRefTimes[netsta].P_NLL != null) {
  //   result.push({ color: store.settings['color.TTTNLL'], x: props.stationRefTimes[netsta].P_NLL, text: 'P (NLL)', position: 'bottom' })
  // }
  // if (props.stationRefTimes[netsta].S_NLL != null) {
  //   result.push({ color: store.settings['color.TTTNLL'], x: props.stationRefTimes[netsta].S_NLL, text: 'S (NLL)', position: 'bottom' })
  // }
  if (store.pickMap[netsta] != null) {
    for (const picks of Object.values(store.pickMap[netsta])) {
      for (const p of picks) {
        const range: [number, number] | undefined = p.time.uncertainty != null
          ? [p.time.uncertainty * 1e3, p.time.uncertainty * 1e3]
          : undefined
        result.push({
          arrow: p.polarity === 'positive' ? 'top' : p.polarity === 'negative' ? 'bottom' : undefined,
          color: p.evaluationMode === 'manual' ? store.settings['color.pickManual'] : store.settings['color.pickAutomatic'],
          text: p.phaseHint,
          position: 'top',
          x: p.time.object.getTime(),
          range
        })
      }
    }
  }
  return result
}

function selectStation(netsta: string) {
  if (selected.value != null) {
    const series = chartData[selected.value].chart.opt.series as LineOptions[]
    series[0].color = store.settings['color.waveform']
    chartData[selected.value].chart.draw()
  }
  selected.value = netsta
  const series = chartData[netsta].chart.opt.series as LineOptions[]
  series[0].color = store.settings['color.activeWaveform']
  chartData[netsta].chart.draw()
  emit('selectStation', netsta)
}

function getSelectedIndex() {
  return chartData[selected.value!].index
}

function selectNext() {
  const currentIndex = getSelectedIndex()
  const index = currentIndex + 1 > listData.value.length - 1 ? 0 : currentIndex + 1
  for (const [netsta, data] of Object.entries(chartData)) {
    if (data.index === index) {
      selectStation(netsta)
      break
    }
  }
}

function selectPrev() {
  const currentIndex = getSelectedIndex()
  const index = currentIndex - 1 < 0 ? listData.value.length - 1 : currentIndex - 1
  for (const [netsta, data] of Object.entries(chartData)) {
    if (data.index === index) {
      selectStation(netsta)
      break
    }
  }
}

function toSerie(data: WaveformProcessInterface) {
  const netsta = toNetSta(data.id)
  return {
    name: '',
    aggregation: 'max',
    start: data.start,
    step: data.step,
    data: data.values,
    color: netsta === selected.value ? store.settings['color.activeWaveform'] : store.settings['color.waveform'],
    enabled: true
  }
}

function createChart(chartContainer: HTMLElement, data: WaveformProcessInterface) {
  const netsta = toNetSta(data.id)
  const result = new Lichen(chartContainer, {
    header: { title: netsta, position: 'left', width: 150 }, legend: { enabled: false },
    xAxis: { enabled: false, gridEnabled: false }, yAxis: { enabled: false, gridEnabled: false, width: 0 },
    crosshair: { enabled: false, sticky: false }, synced: () => charts,
    selection: null, tooltip: false, serieHeight: store.settings['picker.listWaveformHeight'],
    height: store.settings['picker.listWaveformHeight'],
    type: store.settings['picker.listMode'],
    colorScale: store.settings['picker.listMode'] === 'heatmap2d' ? {
      min: null, max: null, logarithmic: false,
      stops: Lichen.getColorScale(store.settings['color.spectrogram']),
    } : undefined,
    vLines: getVLines(netsta), series: [toSerie(data)],
    hooks: {
      beforeResetDisplay: () => false,
      beforeUpdate: (chart: Lichen) => {
        const dataUtils = chart.master.getRegistered('DATA_UTILS')
        updateTimeWindow(chart.opt.header.title!, dataUtils.start!, dataUtils.end!)
        const [yMin, yMax] = [dataUtils.yMin, dataUtils.yMax]
        if (yMin != null && yMax != null && dataUtils.computed.series != null && dataUtils.computed.series[0] != null) {
          const halfAmplitude = (yMax - yMin) / 2
          dataUtils.yMin = dataUtils.computed.series[0].avgValue - halfAmplitude
          dataUtils.yMax = dataUtils.computed.series[0].avgValue + halfAmplitude
          return true
        }
        return false
      },
      onClick: (chart: Lichen) => selectStation(chart.opt.header.title!)
    }
  }, false)
  return result
}

function updateVlines() {
  for (const [netsta, currChartData] of Object.entries(chartData)) {
    currChartData.chart.opt.vLines = getVLines(netsta)
    const chartFrontPanel = currChartData.chart.master.getRegistered('FRONT_PANEL')
    chartFrontPanel.update(null)
  }
}

async function update(redraw=false) {
  const data = await processWaveforms()
  if (!initialized.value && data.length > 0) {
    const refTime = getRefTime(data[0].id)
    const serie = toSerie(data[0])
    start.value = serie.start - refTime
    end.value = (serie.start + serie.data.length * serie.step) - refTime
  }
  const sorted = document.createDocumentFragment()
  for (const [index, currData] of data.entries()) {
    const netsta = toNetSta(currData.id)
    if (chartData[netsta] == null) {
      const div = document.createElement('div')
      container.value.appendChild(div)
      const chart = createChart(div, currData)
      chartData[netsta] = { index, chart, container: div }
      const [x1, x2] = getXRange(netsta)
      chart.setXRange(x1, x2)
    } else {
      chartData[netsta].index = index
      if (redraw) {
        const chart = chartData[netsta].chart
        chart.opt.series = [toSerie(currData)]
        chart.setYRange(null, null)
      }
    }
    sorted.appendChild(chartData[netsta].container)
  }
  container.value.appendChild(sorted)
  if (!initialized.value && data[0] != null) {
    selectStation(toNetSta(data[0].id))
    initialized.value = true
  }
}

function reset() {
  for (const chart of Object.values(charts)) {
    chart.destroy()
  }
  container.value.innerHTML = ''
  chartData = {}
}

watch(() => props.filter, () => update(true))

watch(() => store.settings, () => {
  reset()
  update(true)
})

watch([
  () => props.sortTrace,
  () => props.data
], () => update(false))

watch(() => store.pickMap, () => updateVlines())

watch(() => store.keydown, (newValue) => {
  if (newValue === store.settings['keybinding.nextStation']) {
    store.preventDefault()
    selectNext()
  } else if (newValue === store.settings['keybinding.prevStation']) {
    store.preventDefault()
    selectPrev()
  }
})

watch(() => props.refTimeKey, () => {
  for (const current of Object.values(chartData)) {
    const [t1, t2] = getXRange(current.chart.opt.header.title!)
    current.chart.setXRange(t1, t2)
  }
})

onMounted(update)
</script>

<template>
  <div ref="container"></div>
</template>