<script setup lang="ts">
import type { FilterOptions, PickerToolbarOptions, StationRefTimes, WaveformData, PickMap, ChartData } from '@/types'
import type { LineOptions, VLine } from '@/lib/lichen/src/types'
import type { Trace } from '@/lib/sismojs/src/core/waveform'
import { applyFilter, getDefault, toNetSta } from '@/utils'
import { ref, watch, computed, onMounted } from 'vue'
import type { Pick } from '@/lib/sismojs/src/types'
import { useAppStore } from '@/stores/app'
import Lichen from '@/lib/lichen/src'
import L from 'leaflet'

const REDRAW = 0b001
const UPDATE_VLINES = 0b010

const emit = defineEmits(['selectStation', 'update:start', 'update:end'])

const store = useAppStore()

const props = defineProps<{
  data: Trace[]
  sortTrace: PickerToolbarOptions['sort']
  pickMap: PickMap
  filter: FilterOptions | null
  refTimeKey: string
  stationRefTimes: StationRefTimes
  stationDistance: Record<string,number>
}>()

const container = ref()
const start = ref(-2e3)
const end = ref(10e3)
const charts: Record<number, Lichen> = {}
let chartData: Record<string, ChartData> = {}
const selected = ref(null as string | null)
const initialized = ref(false)

const listData = computed(() => {
  const result: Trace[] = []
  const netstaTrace: Record<string, Trace[]> = {}
  for (const tr of props.data) {
    const netsta = `${tr.stats.network}.${tr.stats.station}`
    getDefault(netstaTrace, netsta, []).push(tr)
  }
  const netstaList = Object.keys(netstaTrace)
  if (props.sortTrace === 'distance') {
    netstaList.sort((a, b) => {
      const aa = props.stationDistance[a]
      const bb = props.stationDistance[b]
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
    result.push(tr)
  }
  return result
})

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
    {
      color: 'red',
      x: props.stationRefTimes[netsta].O
    },
    {
      color: 'blue',
      x: props.stationRefTimes[netsta].P,
      text: 'P',
      position: 'bottom'
    },
    {
      color: 'blue',
      x: props.stationRefTimes[netsta].S,
      text: 'S',
      position: 'bottom'
    }
  ]
  if (props.pickMap[netsta] != null) {
    for (const picks of Object.values(props.pickMap[netsta])) {
      for (const p of picks) {
        result.push({
          arrow: p.polarity === 'positive' ? 'top' : p.polarity === 'negative' ? 'bottom' : undefined,
          color: p.evaluation_mode === 'manual' ? 'green' : 'red',
          text: p.phase_hint,
          position: 'top',
          x: p.time._value!.getTime()
        })
      }
    }
  }
  return result
}

function selectStation(netsta: string) {
  if (selected.value != null) {
    const series = chartData[selected.value].chart.opt.series as LineOptions[]
    // const series = stationChart[selected.value].opt.series as LineOptions[]
    series[0].color = store.settings.COLOR.WAVEFORM
    chartData[selected.value].chart.draw()
    // stationChart[selected.value].draw()
  }
  selected.value = netsta
  const series = chartData[netsta].chart.opt.series as LineOptions[]
  // const series = stationChart[netsta].opt.series as LineOptions[]
  series[0].color = store.settings.COLOR.ACTIVE_WAVEFORM
  chartData[netsta].chart.draw()
  // stationChart[netsta].draw()
  emit('selectStation', netsta)
}

function getSelectedIndex() {
  return chartData[selected.value!].index
  // return waveformsData.indexOf(waveformsData.find(x => x.name === selected.value)!)
}

function selectNext() {
  const currentIndex = getSelectedIndex()
  const index = currentIndex + 1 >= listData.value.length - 1 ? 0 : currentIndex + 1
  for (const [netsta, data] of Object.entries(chartData)) {
    if (data.index === index) {
      selectStation(netsta)
      break
    }
  }
  // selectStation(waveformsData[index >= waveformsData.length ? 0 : index].name)
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
  // selectStation(waveformsData[index < 0 ? waveformsData.length - 1 : index].name)
}

function getSerie(tr: Trace) {
  let values = tr.data
  if (props.filter != null) {
    values = applyFilter(props.filter, tr.stats.samplingRate, values)
  }
  const netsta = toNetSta(tr.stats.id)
  return {
    start: tr.stats.starttime!,
    step: 1000 / tr.stats.samplingRate,
    data: values,
    color: selected.value === netsta ? store.settings.COLOR.ACTIVE_WAVEFORM : store.settings.COLOR.WAVEFORM,
    enabled: true
  }
}

function createChart(chartContainer: HTMLElement, tr: Trace) {
  const netsta = toNetSta(tr.stats.id)
  const result = new Lichen(chartContainer, {
    header: { title: netsta, position: 'left', width: 150 },
    legend: { enabled: false },
    crosshair: { enabled: false, sticky: false },
    synced: () => charts,
    xAxis: { enabled: false, gridEnabled: false },
    yAxis: { enabled: false, gridEnabled: false },
    selection: null,
    tooltip: false,
    type: 'line',
    height: 40,
    vLines: getVLines(netsta),
    series: [getSerie(tr)],
    hooks: {
      beforeResetDisplay: () => false,
      beforeUpdate: (chart: Lichen) => {
        const dataUtils = chart.dataUtils
        updateTimeWindow(chart.opt.header.title!, dataUtils.start!, dataUtils.end!)
        const [yMin, yMax] = [dataUtils.yMin, dataUtils.yMax]
        if (yMin != null && yMax != null && dataUtils.computed.series != null && dataUtils.computed.series[0] != null) {
          const halfAmplitude = (yMax - yMin) / 2
          chart.dataUtils.yMin = dataUtils.computed.series[0].avgValue - halfAmplitude
          chart.dataUtils.yMax = dataUtils.computed.series[0].avgValue + halfAmplitude
          return true
        }
        return false
      },
      onClick: (chart: Lichen) => selectStation(chart.opt.header.title!)
    }
  }, false)
  return result
}

function update(actionBitMap = 0) {
  if (!initialized.value && listData.value.length > 0) {
    const refTime = getRefTime(listData.value[0].stats.id)
    const serie = getSerie(listData.value[0])
    start.value = serie.start - refTime
    end.value = (serie.start + serie.data.length * serie.step) - refTime
  }
  for (const [index, tr] of listData.value.entries()) {
    const netsta = toNetSta(tr.stats.id)
    if (chartData[netsta] == null) {
      const div = document.createElement('div')
      container.value.appendChild(div)
      const chart = createChart(div, tr)
      chartData[netsta] = { index, chart, container: div }
      const [x1, x2] = getXRange(netsta)
      chart.setXRange(x1, x2)
    } else {
      chartData[netsta].index = index
      const chart = chartData[netsta].chart
      if (actionBitMap & UPDATE_VLINES) {
        chart.opt.vLines = getVLines(netsta)
        chart.frontPanel.update(null)
      }
      if (actionBitMap & REDRAW) {
        chart.opt.series = [getSerie(tr)]
        chart.setYRange(null, null)
      }
    }
  }
  if (!initialized.value && listData.value[0] != null) {
    selectStation(toNetSta(listData.value[0].stats.id))
    initialized.value = true
  }
  const sorted = document.createDocumentFragment()
  for (const tr of listData.value) {
    sorted.appendChild(chartData[toNetSta(tr.stats.id)].container)
  }
  container.value.appendChild(sorted)
}

watch(() => props.filter, () => update(REDRAW))

watch(() => props.pickMap, () => update(UPDATE_VLINES))

watch(() => props.sortTrace, () => update())

watch(() => store.keydown, (newValue) => {
  if (newValue === store.settings.KEYBINDING.NEXT_STATION) {
    selectNext()
  } else if (newValue === store.settings.KEYBINDING.PREV_STATION) {
    selectPrev()
  }
})

watch(() => props.refTimeKey, () => {
  for (const current of Object.values(chartData)) {
    const [t1, t2] = getXRange(current.chart.opt.header.title!)
    current.chart.setXRange(t1, t2)
  }
})

watch(() => props.data, () => update())

onMounted(update)
</script>

<template>
  <div ref="container"></div>
</template>