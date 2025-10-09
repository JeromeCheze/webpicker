<script setup lang="ts">
import { DenoiseProcessor, RotateProcessor, FilterProcessor, SpectrogramProcessor, IntegrationProcessor, GapInterpolationProcessor } from '@/utils/waveformProcessor'
import type { FilterOptions, StationRefTimes, ChartData, WaveformProcessInterface, PickerToolbarOptions } from '@/types'
import type { QPick } from '@/lib/sismojs/src/core/event/types'
import type { Trace } from '@/lib/sismojs/src/core/waveform'
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import type { VLine } from '@/lib/lichen/src/types'
import { useAppStore } from '@/stores/app'
import Lichen from '@/lib/lichen/src'
import { toNetSta } from '@/utils'

const emit = defineEmits(['activeChannel', 'createPick', 'selectPicks', 'pickerTime', 'updateTimeWindow'])

const store = useAppStore()

const props = defineProps<{
  activeStation: string | null
  denoiser: boolean
  spectrogram: boolean
  detector: boolean
  rotation: 'ZNE' | 'ZRT'
  filter: FilterOptions | null
  phase: 'P' | 'S' | undefined
  data: Trace[]
  refTimeKey: PickerToolbarOptions['alignment']
  stationRefTimes: StationRefTimes
  controller: AbortController
  commonScale: boolean
  integration: boolean
  interpolate: boolean
  hideRefTimes: boolean
  tttEnabled: boolean
  timeWindow: [number, number]
}>()

const container = ref()
const start = ref(-6e3)
const end = ref(6e3)
const charts: Record<number, Lichen> = {}
let chartData: Record<string, ChartData> = {}
const chartWidth = ref(800)
const pickerTime = ref('')
const spectrogramRange = ref([0, 100] as [number, number])

const denoiseProcessor = new DenoiseProcessor(store.dataManager, props.controller.signal)
const integrationProcessor = new IntegrationProcessor()
const rotateProcessor = new RotateProcessor()
const filterProcessor = new FilterProcessor()
const spectrogramProcessor = new SpectrogramProcessor()
const interpolateProcessor = new GapInterpolationProcessor()

const loading = ref(false)

const waveformData = computed(() => {
  const result: WaveformProcessInterface[] = []
  if (props.activeStation != null) {
    for (const tr of props.data) {
      if (tr.stats.id.startsWith(props.activeStation)) {
        result.push({
          id: tr.stats.id,
          start: tr.stats.starttime as number,
          step: 1e3 / tr.stats.samplingRate,
          values: tr.data
        })
      }
    }
  }
  return result
})

const distance = computed(() => {
  const value = store.dataManager.getStationDistance(props.activeStation!)
  if (value != null) {
    return value
  }
  return -1
})

const azimuth = computed(() => {
  const value = store.dataManager.getStationAzimuth(props.activeStation!)
  if (value != null) {
    return value
  }
  return -1
})

async function processWaveforms() {
  loading.value = true
  let data = waveformData.value
  data = await interpolateProcessor.setEnable(props.interpolate).process(data)
  data = await denoiseProcessor.setEnable(props.denoiser).process(data)
  data = await integrationProcessor.setEnable(props.integration).process(data)
  data = await rotateProcessor.setEnable(props.rotation === 'ZRT').setAzimuth(azimuth.value).process(data)
  data = await filterProcessor.setEnable(props.filter != null).setFilterParams(props.filter).process(data)
  data = await spectrogramProcessor.setEnable(props.spectrogram).process(data)
  loading.value = false
  return data
}

function getRefTime(seedid: string) {
  if (props.refTimeKey === 'O') {
    return props.stationRefTimes[toNetSta(seedid)][props.refTimeKey]
  }
  const netsta = toNetSta(seedid)
  if (store.eventManager.pickMap[netsta] != null) {
    for (const pickList of Object.values(store.eventManager.pickMap[netsta])) {
      for (const pick of pickList) {
        if (pick.phaseHint === props.refTimeKey) {
          return pick.time.object.getTime()
        }
      }
    }
  }
  return props.stationRefTimes[toNetSta(seedid)][props.refTimeKey]
}

function getXRange(seedid: string) {
  const refTime = getRefTime(seedid)
  return [refTime + start.value, refTime + end.value]
}

function updateTimeWindow(seedid: string, t1: number, t2: number) {
  emit('updateTimeWindow', [t1, t2])
  const refTime = getRefTime(seedid)
  start.value = t1 - refTime
  end.value = t2 - refTime
}

function getPickTooltip(p: QPick) {
  return `<table class="pick-tooltip"><tbody>
    <tr><th>Pick time</th><td>${p.time.value}</td></tr>
    <tr><th>WFID</th><td>${p.waveformID.seedid}</td></tr>
    <tr><th>Filter</th><td>${p.filterID || '-'}</td></tr>
    <tr><th>Method</th><td>${p.methodID || '-'}</td></tr>
    <tr><th>Uncertainty</th><td>${p.time.uncertainty || '-'}</td></tr>
    <tr><th>Creation time</th><td>${p.creationInfo?.creationTime}</td></tr>
    <tr><th>Author</th><td>${p.creationInfo?.author}</td></tr>
    <tr><th>Pick ID</th><td>${p.publicID}</td></tr>
    <tr><th>Event ID</th><td>${p.parent.id}</td></tr>
  </tbody></table>`
}

function pickToVLine(p: QPick, selectable: boolean) {
  const text = [p.phaseHint]
  if (p.evaluationStatus != null) {
    text.push(`(${p.evaluationStatus})`)
  }
  if (p.onset != null) {
    text.push(`(${p.onset})`)
  }
  const range: [number, number] | undefined = p.time.uncertainty != null
    ? [p.time.uncertainty * 1e3, p.time.uncertainty * 1e3]
    : undefined
  let color = p.evaluationStatus != null
    ? store.settings['color.pickStatusDefined']
    : p.evaluationMode === 'manual'
      ? store.settings['color.pickManual']
      : store.settings['color.pickAutomatic']
  if (!selectable) {
    color = p.evaluationMode === 'manual' ? store.settings['color.additionalPickManual'] : store.settings['color.additionalPickAutomatic']
  }
  return {
    arrow: p.polarity === 'positive' ? 'top' : p.polarity === 'negative' ? 'bottom' : undefined,
    color,
    text: text.join(' '),
    position: 'top',
    selectable,
    x: p.time.object.getTime(),
    data: p.publicID,
    tooltip: getPickTooltip(p),
    range
  } as VLine
}

function getVLines(index: number, dataLength: number, seedid: string) {
  const netsta = toNetSta(seedid)
  const result: VLine[] = []
  if (!props.hideRefTimes) {
    result.push({ color: store.settings['color.T0'], x: props.stationRefTimes[netsta].O, text: index === dataLength - 1 ? 'T0' : undefined, position: 'bottom' })
    if (props.tttEnabled) {
      result.push({ color: store.settings['color.TTT'], x: props.stationRefTimes[netsta].P, text: index === dataLength - 1 ? 'P' : undefined, position: 'bottom' })
      result.push({ color: store.settings['color.TTT'], x: props.stationRefTimes[netsta].S, text: index === dataLength - 1 ? 'S' : undefined, position: 'bottom' })
      if (props.stationRefTimes[netsta].P_NLL != null) {
        result.push({ color: store.settings['color.TTTNLL'], x: props.stationRefTimes[netsta].P_NLL, text: index === dataLength - 1 ? 'P (NLL)' : undefined, position: 'bottom' })
      }
      if (props.stationRefTimes[netsta].S_NLL != null) {
        result.push({ color: store.settings['color.TTTNLL'], x: props.stationRefTimes[netsta].S_NLL, text: index === dataLength - 1 ? 'S (NLL)' : undefined, position: 'bottom' })
      }
    }
  }
  if (props.detector) {
    const key = store.dataManager.getDetectionKey(
      netsta,
      store.settings['detector.model'],
      store.settings['detector.dataset'],
      store.settings['detector.pThreshold'],
      store.settings['detector.sThreshold']
    )
    const detection = store.dataManager.detectorCache[key]
    if (detection != null) {
      for (const d of detection) {
        result.push({ color: store.settings['color.detector'], x: d.time, text: index === dataLength - 1 ? d.phase : undefined, position: 'bottom' })
      }
    }
  }
  if (store.eventManager.pickMap[netsta] != null) {
    for (const [currSeedid, pickList] of Object.entries(store.eventManager.pickMap[netsta])) {
      for (const p of pickList) {
        if (currSeedid === seedid) {
          result.push(pickToVLine(p, true))
        } else if (props.rotation !== 'ZRT' && index === 0 && ['R', 'T'].indexOf(currSeedid.slice(-1)) >= 0) {
          result.push(pickToVLine(p, true))
        }
        // else if (props.rotation === 'ZRT' && index === 0 && ['Z', 'R', 'T'].indexOf(currSeedid.slice(-1)) < 0) {
        //   result.push(pickToVLine(p, true))
        // }
      }
    }
  }
  if (store.eventManager.additionalPickMap[netsta] != null && store.eventManager.additionalPickMap[netsta][seedid] != null) {
    for (const p of store.eventManager.additionalPickMap[netsta][seedid]) {
      result.push(pickToVLine(p, false))
    }
  }
  return result
}

function handleVlineSelection(vlines: VLine[]) {
  emit('selectPicks', vlines.map(x => x.data))
}

function toSerie(data: WaveformProcessInterface) {
  return {
    start: data.start,
    step: data.step,
    data: data.values,
    color: store.settings['color.waveform'],
    enabled: true
  }
}

function createSpectrogram(chartContainer: HTMLElement, index: number, waveformLength: number, dataLength: number, data: WaveformProcessInterface) {
  const fontSize = store.settings['picker.tickFontSize']
  const result = new Lichen(chartContainer, {
    header: { title: data.id.replace('..', '.--.').split('.').slice(2, 4).join('.'), position: 'left', width: 100 },
    legend: { enabled: false }, crosshair: { enabled: false }, synced: () => charts,
    xAxis: { enabled: index === dataLength - 1, fontSize },
    yAxis: { max: Math.min(data.spectrogram!.yMax, 50), fontSize },
    selection: null, tooltip: false, type: 'heatmap3d', autoResize: false, zoom: 'x',
    height: store.settings['picker.spectrogramHeight'], width: chartWidth.value, 
    colorScale: {
      min: 0, max: data.spectrogram!.zMax, logarithmic: false,
      stops: Lichen.getColorScale(store.settings['color.spectrogram'])
    },
    series: {
      smoothing: true,
      start: data.start, step: data.step, data: data.spectrogram!.values,
      yMin: data.spectrogram!.yMin, yMax: data.spectrogram!.yMax,
      zMin: data.spectrogram!.zMin, zMax: data.spectrogram!.zMax
    },
    hooks: {
      beforeResetDisplay: () => false,
      beforeDraw: (chart: Lichen) => {
        const dataUtils = chart.master.getRegistered('DATA_UTILS')
        if (props.activeStation != null) {
          updateTimeWindow(props.activeStation!, dataUtils.start!, dataUtils.end!)
          return true
        }
        return false
      }
    }
  }, false)
  return result
}

function createWaveform(chartContainer: HTMLElement, index: number, waveformLength: number, dataLength: number, data: WaveformProcessInterface) {
  const fontSize = store.settings['picker.tickFontSize']
  const result = new Lichen(chartContainer, {
    header: { title: data.id.replace('..', '.--.').split('.').slice(2, 4).join('.'), position: 'left', width: 100 },
    legend: { enabled: false }, synced: () => charts,
    crosshair: { enabled: props.phase != null, text: index === 0 ? props.phase : '', sticky: false },
    xAxis: { enabled: index === dataLength - 1, fontSize }, yAxis: { fontSize },
    selection: null, tooltip: false, autoResize: false,
    type: 'line', height: store.settings['picker.pickerWaveformHeight'], width: chartWidth.value, 
    vLines: getVLines(index, waveformLength, data.id),
    series: [toSerie(data)],
    hooks: {
      onCursorMove: (x: number, y: number) => {
        pickerTime.value = new Date(x).toISOString().replace('T', ' ').replace('Z', '')
        emit('pickerTime', x)
      },
      onVlineSelection: handleVlineSelection,
      onDblClick: (t: number) => emit('createPick', t),
      onActive: (chart: Lichen) => emit('activeChannel', `${props.activeStation}.${chart.opt.header.title?.replace('--', '')}`),
      beforeResetDisplay: () => false,
      beforeDraw: (chart: Lichen) => {
        const dataUtils = chart.master.getRegistered('DATA_UTILS')
        if (props.activeStation != null) {
          updateTimeWindow(props.activeStation!, dataUtils.start!, dataUtils.end!)
          const [yMin, yMax] = [dataUtils.yMin, dataUtils.yMax]
          if (yMin != null && yMax != null && dataUtils.computed.series != null && dataUtils.computed.series[0] != null) {
            const halfAmplitude = (yMax - yMin) / 2
            dataUtils.yMin = dataUtils.computed.series[0].quarterLeftAvg - halfAmplitude
            dataUtils.yMax = dataUtils.computed.series[0].quarterLeftAvg + halfAmplitude
            return true
          }
        }
        return false
      }
    }
  }, false)
  return result
}

function updateVlines() {
  const waveformLength = Object.values(chartData).filter(x => !x.spectrogram).length
  for (const [netsta, currChartData] of Object.entries(chartData)) {
    if (currChartData.spectrogram == null) {
      const chartFrontPanel = currChartData.chart.master.getRegistered('FRONT_PANEL')
      currChartData.chart.opt.vLines = getVLines(currChartData.index, waveformLength, netsta)
      chartFrontPanel.update(null)
    }
  }
}

function updateCrosshair() {
  for (const currChartData of Object.values(chartData)) {
    if (currChartData.spectrogram == null) {
      const chart = currChartData.chart
      chart.opt.crosshair!.enabled = props.phase != null
      chart.opt.crosshair!.text = currChartData.index === 0 ? props.phase : ''
    }
  }
}

async function update(redraw=false) {
  if (container.value != null && props.activeStation != null) {
    const data = await processWaveforms()
    chartWidth.value = Math.floor(container.value.getBoundingClientRect().width)
    for (const currData of data) {
      if (chartData[currData.id] == null) {
        redraw = true
      }
    }
    const [x1, x2] = getXRange(props.activeStation!)
    const maxRange: Record<string, number> = {}
    const waveformLength = Object.values(data).filter(x => !x.spectrogram).length
    for (const [index, currData] of data.entries()) {
      if (chartData[currData.id] == null) {
        const div = document.createElement('div')
        container.value.appendChild(div)
        const chartBuilder = currData.spectrogram != null ? createSpectrogram : createWaveform
        const chart = chartBuilder(div, index, waveformLength, data.length, currData)
        chart.setXRange(x1, x2, false)
        chartData[currData.id] = { index, chart, container: div, spectrogram: currData.spectrogram }
        if (currData.spectrogram != null) {
          chart.setYRange(null, null)
        }
        // const [x1, x2] = getXRange(currData.id)
      } else {
        chartData[currData.id].index = index
        const chart = chartData[currData.id].chart
        if (redraw) {
          chart.opt.xAxis!.enabled = index === data.length - 1
          chart.opt.series = [toSerie(currData)]
        }
      }
      if (chartData[currData.id] != null && props.commonScale) {
        const chart = chartData[currData.id].chart
        chart.setYRange(null, null, false)
        const dataUtils = chart.master.getRegistered('DATA_UTILS')
        const key = currData.id.slice(0, -1)
        if (maxRange[key] == null) {
          maxRange[key] = 0
        }
        maxRange[key] = Math.max(maxRange[key], dataUtils.yMax - dataUtils.yMin)
      }
    }
    for (const [id, currData] of Object.entries(chartData)) {
      if (props.commonScale) {
        const key = id.slice(0, -1)
        const midRange = maxRange[key] / 2
        const dataUtils = currData.chart.master.getRegistered('DATA_UTILS')
        const mid = dataUtils.yMin + (dataUtils.yMax - dataUtils.yMin) / 2
        currData.chart.setYRange(mid - midRange, mid + midRange, false)
        currData.chart.draw()
      } else {
        currData.chart.setYRange(null, null)
      }
    }
    updateVlines()
    updateCrosshair()
    updateSpectrogramRange()
  }
}

function reset() {
  for (const chart of Object.values(charts)) {
    chart.destroy()
  }
  container.value.innerHTML = ''
  chartData = {}
}

function updateSpectrogramRange() {
  for (const currChart of Object.values(chartData)) {
    if (currChart.spectrogram != null) {
      const [min, max] = [currChart.spectrogram.zMin, currChart.spectrogram.zMax]
      const amp = max - min
      if (currChart.chart.opt.colorScale) {
        currChart.chart.opt.colorScale.min = min + amp * spectrogramRange.value[0] / 100
        currChart.chart.opt.colorScale.max = min + amp * spectrogramRange.value[1] / 100
        currChart.chart.master.getRegistered('PLOT').update(true)
      }
    }
  }
}

watch(() => spectrogramRange.value, (value, oldValue) => {
  if (value[0] != oldValue[0] || value[1] != oldValue[1]) {
    updateSpectrogramRange()
  }
})

watch([
  () => props.activeStation,
  () => props.denoiser,
  () => props.interpolate,
  () => props.integration,
  () => props.rotation,
  () => props.filter,
  () => props.spectrogram,
  () => store.settings,
  () => props.commonScale
], () => {
  reset()
  update(true)
})

watch(() => props.data, (value, oldValue) => {
  const currSeedIds = value.map(x => x.stats.id).filter(x => toNetSta(x) === props.activeStation)
  const prevSeedIds = oldValue.map(x => x.stats.id).filter(x => toNetSta(x) === props.activeStation)
  for (const seedid of currSeedIds) {
    if (prevSeedIds.indexOf(seedid) < 0) {
      update(true)
      break
    }
  }
})

watch([
  () => store.eventManager.pickMap,
  () => store.eventManager.additionalPickMap,
  () => props.detector,
  () => props.tttEnabled
], () => updateVlines())

watch(() => store.dataManager.detectorCache, () => updateVlines(), { deep: true })

watch(() => props.phase, () => updateCrosshair())

watch(() => props.refTimeKey, () => {
  for (const chart of Object.values(charts)) {
    const [t1, t2] = getXRange(props.activeStation!)
    chart.setXRange(t1, t2)
  }
})

watch(() => props.timeWindow, () => {
  const allCharts = Object.values(chartData)
  if (allCharts.length > 0) {
    allCharts[0].chart.master.send('xRangeChange', props.timeWindow)
  }
})

watch(() => store.keydown, (value) => {
  const allCharts = Object.values(chartData)
  if (allCharts.length > 0) {
    const dataUtils = allCharts[0].chart.master.getRegistered('DATA_UTILS')
    const range = dataUtils.yMax - dataUtils.yMin
    if (value === store.settings['keybinding.yZoomIn']) {
      allCharts[0].chart.master.send('yRangeChange', [
        dataUtils.yMin - 0.1 * range,
        dataUtils.yMax + 0.1 * range
      ])
    }  else if (value === store.settings['keybinding.yZoomOut']) {
      allCharts[0].chart.master.send('yRangeChange', [
        dataUtils.yMin + 0.1 * range,
        dataUtils.yMax - 0.1 * range
      ])
    }
  }
})

onBeforeUnmount(reset)
</script>

<template>
  <v-card :style="{ overflowY: 'auto' }">
    <v-card-title>
      {{ props.activeStation }}
      <span class="float-right">{{ props.phase != null ? pickerTime : '' }}</span>
      <span >- Dist: {{ distance.toFixed(1) }} km | Az: {{ azimuth.toFixed(1) }}&deg;</span>
      <v-progress-circular v-if="loading" indeterminate="disable-shrink" size="20" class="ml-4"/>
    </v-card-title>
    <v-card-text>
      <div ref="container"></div>
    </v-card-text>
    <v-card-actions v-if="props.spectrogram" class="justify-end">
      <v-col cols="4">
        <v-range-slider label="Spectrogram color range" v-model="spectrogramRange" step="5" thumb-label></v-range-slider>
      </v-col>
    </v-card-actions>
  </v-card>
</template>

<style>
.pick-tooltip th {
  text-align: right;
}
.pick-tooltip th,
.pick-tooltip td {
  padding: 0 5px;
}
</style>