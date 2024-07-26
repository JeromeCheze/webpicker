<script setup lang="ts">
import { DenoiseProcessor, RotateProcessor, FilterProcessor, SpectrogramProcessor, IntegrationProcessor } from '@/utils/waveformProcessor'
import type { FilterOptions, StationRefTimes, ChartData, WaveformProcessInterface, PickerToolbarOptions } from '@/types'
import type { Pick } from '@/lib/sismojs/src/core/event/types'
import type { Trace } from '@/lib/sismojs/src/core/waveform'
import type { VLine } from '@/lib/lichen/src/types'
import { toNetSta } from '@/utils'
import { ref, watch, computed } from 'vue'
import { useAppStore } from '@/stores/app'
import Lichen from '@/lib/lichen/src'

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
}>()

const container = ref()
const start = ref(-6e3)
const end = ref(6e3)
const charts: Record<number, Lichen> = {}
let chartData: Record<string, ChartData> = {}
const chartWidth = ref(800)
const pickerTime = ref('')

const denoiseProcessor = new DenoiseProcessor(store.dataManager, props.controller.signal)
const integrationProcessor = new IntegrationProcessor()
const rotateProcessor = new RotateProcessor()
const filterProcessor = new FilterProcessor()
const spectrogramProcessor = new SpectrogramProcessor()

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
  if (store.pickMap[netsta] != null) {
    for (const pickList of Object.values(store.pickMap[netsta])) {
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

function getPickTooltip(p: Pick) {
  return `<table class="pick-tooltip"><tbody>
    <tr><th>Creation time</th><td>${p.creationInfo?.creationTime}</td></tr>
    <tr><th>WFID</th><td>${p.waveformID.seedid}</td></tr>
    <tr><th>Filter</th><td>${p.filterID || '-'}</td></tr>
    <tr><th>Author</th><td>${p.creationInfo?.author}</td></tr>
  </tbody></table>`
}

function pickToVLine(p: Pick, selectable: boolean) {
  const text = [p.phaseHint]
  if (p.onset != null) {
    text.push(`(${p.onset})`)
  }
  const range: [number, number] | undefined = p.time.uncertainty != null
    ? [p.time.uncertainty * 1e3, p.time.uncertainty * 1e3]
    : undefined
  let color = p.evaluationMode === 'manual' ? store.settings['color.pickManual'] : store.settings['color.pickAutomatic']
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
  const result: VLine[] = [
    { color: store.settings['color.TTT'], x: props.stationRefTimes[netsta].P, text: index === dataLength - 1 ? 'P' : undefined, position: 'bottom' },
    { color: store.settings['color.TTT'], x: props.stationRefTimes[netsta].S, text: index === dataLength - 1 ? 'S' : undefined, position: 'bottom' },
    { color: store.settings['color.T0'], x: props.stationRefTimes[netsta].O, text: index === dataLength - 1 ? 'T0' : undefined, position: 'bottom' }
  ]
  if (props.stationRefTimes[netsta].P_NLL != null) {
    result.push({ color: store.settings['color.TTTNLL'], x: props.stationRefTimes[netsta].P_NLL, text: index === dataLength - 1 ? 'P (NLL)' : undefined, position: 'bottom' })
  }
  if (props.stationRefTimes[netsta].S_NLL != null) {
    result.push({ color: store.settings['color.TTTNLL'], x: props.stationRefTimes[netsta].S_NLL, text: index === dataLength - 1 ? 'S (NLL)' : undefined, position: 'bottom' })
  }
  if (props.detector) {
    const key = `${netsta}-${store.settings['detector.model']}-${store.settings['detector.pThreshold']}-${store.settings['detector.sThreshold']}`
    const detection = store.dataManager.detectorCache[key]
    if (detection != null) {
      for (const d of detection) {
        result.push({ color: store.settings['color.detector'], x: d.time, text: index === dataLength - 1 ? d.phase : undefined, position: 'bottom' })
      }
    }
  }
  if (store.pickMap[netsta] != null) {
    for (const [currSeedid, pickList] of Object.entries(store.pickMap[netsta])) {
      for (const p of pickList) {
        if (currSeedid === seedid) {
          result.push(pickToVLine(p, true))
        } else if (props.rotation !== 'ZRT' && index === 0 && ['R', 'T'].indexOf(currSeedid.slice(-1)) >= 0) {
          result.push(pickToVLine(p, true))
        } else if (props.rotation === 'ZRT' && index === 0 && ['Z', 'R', 'T'].indexOf(currSeedid.slice(-1)) < 0) {
          result.push(pickToVLine(p, true))
        }
      }
    }
    // for (const p of store.pickMap[netsta][seedid]) {
    //   result.push(pickToVLine(p, true))
    // }
  }
  if (store.additionalPickMap[netsta] != null && store.additionalPickMap[netsta][seedid] != null) {
    for (const p of store.additionalPickMap[netsta][seedid]) {
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

function createSpectrogram(chartContainer: HTMLElement, index: number, dataLength: number, data: WaveformProcessInterface) {
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

function createWaveform(chartContainer: HTMLElement, index: number, dataLength: number, data: WaveformProcessInterface) {
  const fontSize = store.settings['picker.tickFontSize']
  const result = new Lichen(chartContainer, {
    header: { title: data.id.replace('..', '.--.').split('.').slice(2, 4).join('.'), position: 'left', width: 100 },
    legend: { enabled: false }, synced: () => charts,
    crosshair: { enabled: props.phase != null, text: index === 0 ? props.phase : '', sticky: false },
    xAxis: { enabled: index === dataLength - 1, fontSize }, yAxis: { fontSize },
    selection: null, tooltip: false, autoResize: false,
    type: 'line', height: store.settings['picker.pickerWaveformHeight'], width: chartWidth.value, 
    vLines: getVLines(index, dataLength, data.id),
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
            dataUtils.yMin = dataUtils.computed.series[0].avgValue - halfAmplitude
            dataUtils.yMax = dataUtils.computed.series[0].avgValue + halfAmplitude
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
  for (const [netsta, currChartData] of Object.entries(chartData)) {
    const chartFrontPanel = currChartData.chart.master.getRegistered('FRONT_PANEL')
    currChartData.chart.opt.vLines = getVLines(currChartData.index, Object.keys(chartData).length, netsta)
    chartFrontPanel.update(null)
  }
}

function updateCrosshair() {
  for (const currChartData of Object.values(chartData)) {
    const chart = currChartData.chart
    chart.opt.crosshair!.enabled = props.phase != null
    chart.opt.crosshair!.text = currChartData.index === 0 ? props.phase : ''
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
    let maxRange: number = 0
    for (const [index, currData] of data.entries()) {
      if (chartData[currData.id] == null) {
        const div = document.createElement('div')
        container.value.appendChild(div)
        const chartBuilder = currData.spectrogram != null ? createSpectrogram : createWaveform
        const chart = chartBuilder(div, index, data.length, currData)
        chart.setXRange(x1, x2, false)
        if (currData.spectrogram == null) {
          chartData[currData.id] = { index, chart, container: div }
        } else {
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
        console.log(currData.id, dataUtils.yMax - dataUtils.yMin)
        maxRange = Math.max(maxRange, dataUtils.yMax - dataUtils.yMin)
      }
    }
    const midRange = maxRange / 2
    for (const currData of Object.values(chartData)) {
      if (props.commonScale) {
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
  }
}

function reset() {
  for (const chart of Object.values(charts)) {
    chart.destroy()
  }
  container.value.innerHTML = ''
  chartData = {}
}

watch([
  () => props.activeStation,
  () => props.denoiser,
  () => props.integration,
  () => props.rotation,
  () => props.filter,
  () => props.spectrogram,
  () => store.settings
], () => {
  reset()
  update(true)
})

watch(() => props.commonScale, () => update(true))

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
  () => store.pickMap,
  () => store.additionalPickMap,
  () => props.detector
], () => updateVlines())

watch(() => store.dataManager.detectorCache, () => updateVlines(), { deep: true })

watch(() => props.phase, () => updateCrosshair())

watch(() => props.refTimeKey, () => {
  for (const chart of Object.values(charts)) {
    const [t1, t2] = getXRange(props.activeStation!)
    chart.setXRange(t1, t2)
  }
})
</script>

<template>
  <div class="mb-3">
    {{ props.activeStation }}
    <span class="text-caption float-right">{{ props.phase != null ? pickerTime : '' }}</span>
    <span class="text-caption">- Dist: {{ distance.toFixed(1) }} km | Az: {{ azimuth.toFixed(1) }}&deg;</span>
    <v-progress-circular v-if="loading" indeterminate="disable-shrink" size="20" class="ml-4"/>
  </div>
  <div ref="container"></div>
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