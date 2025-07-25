<script setup lang="ts">
import type { FilterOptions, PickerToolbarOptions, StationRefTimes, WPNotificationOptions } from '@/types'
import { QPick, type QEvaluationStatus, type QPickOnset, type QPickPolarity } from '@/lib/sismojs/src/core/event/types'
import { ref, shallowRef, watch, onMounted, computed } from 'vue'
import type { Trace } from '@/lib/sismojs/src/core/waveform'
import PickerWaveformList from './PickerWaveformList.vue'
import PickerWaveforms from './PickerWaveforms.vue'
import PickerToolbar from './PickerToolbar.vue'
import { pushUnique, toNetSta } from '@/utils'
import { useAppStore } from '@/stores/app'
import { onBeforeUnmount } from 'vue'

const TRACE_SORT_RULES = ['Z', 'N', '1', 'E', '2', '3', 'H']

const emit = defineEmits(['update:modelValue'])

const props = defineProps<{
  modelValue: boolean
  noEvent: boolean
  seedidList: string[]
  time: number
  latitude: number
  longitude: number
  depth: number
  timeWindow: [number, number]
  baseUrl: string
}>()

const store = useAppStore()
// console.log(store.dataManager)

const contextMenu = ref(false)
const contextMenuPos = ref([0, 0] as [number, number])
const controller = shallowRef(new AbortController())
const data = ref([] as Trace[])

const pickerStation = ref(null as string | null)
const activeChannel = ref(null as string | null)
const selectedPicks = shallowRef([] as QPick[])
const pickerTime = ref(null as number | null)
const pickerTimeWindow = ref([0, 0] as [number, number])
const sliderTimeWindow = ref([0, 0] as [number, number])
const resizerPosition = ref(50)

let shiftFlag = false

const toolbarValue = ref({
  phase: undefined,
  alignment: 'O',
  component: '',
  components: [],
  seedids: [],
  sort: 'distance',
  filter: null,
  rotation: 'ZNE',
  denoiser: false,
  spectrogram: false,
  detector: false,
  commonScale: false,
  integration: false,
  tttEnabled: true
} as PickerToolbarOptions)

const stationRefTimes = ref({} as StationRefTimes)

const filterValue = computed(() => {
  if (toolbarValue.value.filter != null) {
    return store.settings['filter'].find((x: FilterOptions) => x.name === toolbarValue.value.filter) as FilterOptions | null
  }
  return null
})

function handleDetector() {
  if (!toolbarValue.value.detector) {
    return
  }
  let start = null
  let end = null
  let wfid = null
  for (const tr of data.value) {
    if (tr.stats.id.startsWith(pickerStation.value!)) {
      if (wfid == null) {
        wfid = tr.stats.id.slice(0, -1)
      }
      start = start == null ? tr.stats.starttime : Math.min(start, tr.stats.starttime!)
      end = end == null ? tr.stats.endtime : Math.max(end, tr.stats.endtime!)
    }
  }
  if (start != null && end != null) {
    store.dataManager.getDetection(
      props.baseUrl,
      store.settings['detector.model'],
      store.settings['detector.dataset'],
      wfid!,
      new Date(start).toISOString().slice(0, 19),
      new Date(end).toISOString().slice(0, 19),
      store.settings['detector.pThreshold'],
      store.settings['detector.sThreshold'],
      controller.value!.signal
    )
  }
}

function processDataCallback(response: Trace[]) {
  const seedIds = data.value.map(tr => tr.stats.id)
  for (const tr of response) {
    if (seedIds.indexOf(tr.stats.id) >= 0) {
      continue
    }
    const netsta = `${tr.stats.network}.${tr.stats.station}`
    if (stationRefTimes.value[netsta] == null) {
      if (props.noEvent) {
        stationRefTimes.value[netsta] = { O: props.time, P: props.time, S: props.time }
      } else {
        stationRefTimes.value[netsta] = {
          O: props.time,
          P: store.dataManager.getStationPhaseTime(props.time, netsta, 'P'),
          S: store.dataManager.getStationPhaseTime(props.time, netsta, 'S')
        }
        const pNLL = store.dataManager.getNLLStationPhaseTime(props.time, netsta, 'P')
        if (pNLL != null) {
          stationRefTimes.value[netsta].P_NLL = pNLL
        }
        const sNLL = store.dataManager.getNLLStationPhaseTime(props.time, netsta, 'S')
        if (sNLL != null) {
          stationRefTimes.value[netsta].S_NLL = sNLL
        }
      }
    }
  }
  const instrumentGroup: Record<string, Trace[]> = {}
  for (const tr of [...data.value, ...response]) {
    const key = `${tr.stats.location}.${tr.stats.channel.slice(0, -1)}`
    if (instrumentGroup[key] == null) {
      instrumentGroup[key] = []
    }
    instrumentGroup[key].push(tr)
  }
  const result: Trace[] = []
  for (const key of Object.keys(instrumentGroup).sort()) {
    instrumentGroup[key].sort((a, b) => {
      const aa = TRACE_SORT_RULES.indexOf(a.stats.channel.slice(-1))
      const bb = TRACE_SORT_RULES.indexOf(b.stats.channel.slice(-1))
      return aa < bb ? -1 : aa > bb ? 1 : 0
    })
    for (const tr of instrumentGroup[key]) {
      result.push(tr)
    }
  }
  data.value = result
}

function handleNotification(opt: WPNotificationOptions) {
  store.notification.push(opt)
}

function displayWaveforms() {
  if (store.eventManager.current.arrivals == null || controller.value == null) {
    return
  }
  stationRefTimes.value = {}
  const pickList: QPick[] = store.eventManager.current.arrivals.map(x => x.pickID.referredObject)
  pickList.sort((a, b) => {
    const aa = a.time.object
    const bb = b.time.object
    return aa < bb ? -1 : aa > bb ? 1 : 0
  })
  const seedidList: string[] = []
  for (const pick of pickList) {
    pushUnique(seedidList, `${pick.waveformID.seedid.slice(0, -1)}?`)
  }
  store.dataManager.getData(
    props.baseUrl, props.time, props.latitude, props.longitude, props.depth, seedidList,
    store.settings['miscellaneous.maxTrace'], store.settings['miscellaneous.autoAddHydrophone'],
    [store.settings['miscellaneous.timewindow1'], store.settings['miscellaneous.timewindow2']],
    props.noEvent === true,
    controller.value.signal,
    processDataCallback, handleNotification
  )
}

function downloadChannels(seedidList: string[]) {
  if (controller.value == null) {
    return
  }
  store.dataManager.getData(
    props.baseUrl, props.time, props.latitude, props.longitude, props.depth, seedidList,
    store.settings['miscellaneous.maxTrace'], store.settings['miscellaneous.autoAddHydrophone'],
    [props.timeWindow[0], props.timeWindow[1]],
    props.noEvent === true,
    controller.value.signal,
    processDataCallback, handleNotification
  )
}

function handleActiveChannel(seedid: string) {
  activeChannel.value = seedid
}

function handleSelectStation(netsta: string) {
  const components: string[] = []
  const seedIds: string[] = []
  for (const tr of data.value) {
    const current = `${tr.stats.network}.${tr.stats.station}`
    if (current === netsta) {
      components.push(tr.stats.channel.slice(-1))
      seedIds.push(tr.stats.id)
    }
  }
  toolbarValue.value.components = components
  toolbarValue.value.seedids = seedIds
  pickerStation.value = netsta
}


function handleSelectPicks(pickids: string[]) {
  if (pickids.length === 0) {
    contextMenu.value = false
  }
  if (!shiftFlag) {
    const picks: QPick[] = store.eventManager.current.arrivals!
      .map(a => a.pickID.referredObject)
      .filter(p => pickids.indexOf(p.publicID) >= 0)
    selectedPicks.value = picks
  }
}

function createPick() {
  if (pickerTime.value == null || activeChannel.value == null || toolbarValue.value.phase == null) {
    return
  }
  const netsta = toNetSta(activeChannel.value)
  if (store.eventManager.pickMap[netsta] != null) {
    for (const pickList of Object.values(store.eventManager.pickMap[netsta])) {
      for (const pick of pickList) {
        if (pick.phaseHint === toolbarValue.value.phase) {
          store.eventManager.deletePick(pick)
        }
      }
    }
  }
  const filter = []
  if (toolbarValue.value.denoiser) {
    filter.push('deepdenoiser')
  }
  if (toolbarValue.value.integration) {
    filter.push('integration')
  }
  if (filterValue.value != null) {
    filter.push(filterValue.value.expression.replace(/ /g, ''))
  }
  const newPick = store.eventManager.createPick(
    toolbarValue.value.phase,
    pickerTime.value,
    activeChannel.value,
    filter.length > 0 ? filter.join('+') : undefined,
    store.author!
  )
  selectedPicks.value = [newPick]
}

function deleteSelectedPicks() {
  for (const pick of selectedPicks.value) {
    store.eventManager.deletePick(pick)
  }
}

function handleContextMenu(e: MouseEvent) {
  e.preventDefault()
  contextMenuPos.value = [e.clientX, e.clientY]
  contextMenu.value = true
}

function handleClick(e: MouseEvent) {
  if (pickerTime.value != null && selectedPicks.value.length > 0 && shiftFlag) {
    const pTime = selectedPicks.value[0].time.object.getTime()
    setPickUncertainty(Math.abs(pTime - pickerTime.value) / 1e3)
  }
}

function setPickPolarity(value?: QPickPolarity) {
  if (selectedPicks.value.length > 0) {
    console.log(`[PickerPanel.setPickPolarity] value = ${value}`)
    const p = store.eventManager.clonePick(selectedPicks.value[0], store.author!)
    selectedPicks.value = [p]
    if (p.polarity === value) {
      p.polarity = undefined
    } else {
      p.polarity = value
    }
  }
}

function setPickOnset(value: QPickOnset) {
  if (selectedPicks.value.length > 0) {
    console.log(`[PickerPanel.setPickOnset] value = ${value}`)
    const p = store.eventManager.clonePick(selectedPicks.value[0], store.author!)
    selectedPicks.value = [p]
    if (p.onset === value) {
      p.onset = undefined
    } else {
      p.onset = value
    }
  }
}

function setPickUncertainty(value: number) {
  if (selectedPicks.value.length > 0) {
    console.log(`[PickerPanel.setPickUncertainty] value = ${value}`)
    const p = store.eventManager.clonePick(selectedPicks.value[0], store.author!)
    selectedPicks.value = [p]
    if (p.evaluationMode === 'automatic') {
      return
    }
    if (p.time.uncertainty === value) {
      p.time.uncertainty = undefined
    } else {
      if (value === 0) {
        p.time.uncertainty = undefined
      } else {
        p.time.uncertainty = parseFloat(value.toPrecision(3))
      }
    }
  }
}

function setPickEvaluationStatus(value: QEvaluationStatus) {
  if (selectedPicks.value.length > 0) {
    console.log(`[PickerPanel.setPickEvaluationStatus] value = ${value}`)
    const p = selectedPicks.value[0]
    if (p.evaluationStatus === value) {
      p.evaluationStatus = undefined
    } else {
      p.evaluationStatus = value
    }
    store.eventManager.updatePickMap()
  }
}

function handleDragging(e: MouseEvent) {
  e.stopPropagation()
  e.preventDefault()
  const percentage = 100 * (e.pageY - 74) / (window.innerHeight - 80)
  if (percentage >= 20 && percentage <= 90) {
    resizerPosition.value = percentage
  }
  return false
}
function startDragging() {
  document.addEventListener('mousemove', handleDragging)
}
function endDragging() {
  document.removeEventListener('mousemove', handleDragging)
}

watch(() => store.keydown, (value) => {
  shiftFlag = value === 'shift+shift'
  if (value === store.settings['keybinding.createPick']) {
    store.preventDefault()
    createPick()
  } else if (value === store.settings['keybinding.deletePick']) {
    store.preventDefault()
    deleteSelectedPicks()
  } else if (value === store.settings['keybinding.polarityPositive']) {
    setPickPolarity('positive')
  } else if (value === store.settings['keybinding.polarityNegative']) {
    setPickPolarity('negative')
  } else if (value === store.settings['keybinding.resetPolarity']) {
    setPickPolarity()
  } else if (value === store.settings['keybinding.xZoomIn']) {
    const range = pickerTimeWindow.value[1] - pickerTimeWindow.value[0]
    const tw = [
      pickerTimeWindow.value[0] + 0.1 * range,
      pickerTimeWindow.value[1] - 0.1 * range
    ]
    pickerTimeWindow.value = tw as [number, number]
    sliderTimeWindow.value = tw as [number, number]
  }  else if (value === store.settings['keybinding.xZoomOut']) {
    const range = pickerTimeWindow.value[1] - pickerTimeWindow.value[0]
    const tw = [
      pickerTimeWindow.value[0] - 0.1 * range,
      pickerTimeWindow.value[1] + 0.1 * range
    ]
    pickerTimeWindow.value = tw as [number, number]
    sliderTimeWindow.value = tw as [number, number]
  }
})

watch([
  () => pickerStation.value,
  () => toolbarValue.value.detector,
  () => store.settings['detector.model'],
  () => store.settings['detector.dataset'],
  () => store.settings['detector.pThreshold'],
  () => store.settings['detector.sThreshold']
], () => handleDetector())

onMounted(() => {
  console.log('[PickerPanel.onMounted]')
  pickerStation.value = null
  document.body.addEventListener('contextmenu', handleContextMenu)
  document.body.addEventListener('click', handleClick)
  data.value = []
  if (props.noEvent && props.seedidList.length > 0) {
    downloadChannels(props.seedidList)
  } else {
    displayWaveforms()
  }
  store.eventManager.loadAdditionalPicks(props.baseUrl, props.time)
})

onBeforeUnmount(() => {
  console.log('[PickerPanel.onBeforeUnmount]')
  document.body.removeEventListener('contextmenu', handleContextMenu)
  document.body.removeEventListener('click', handleClick)
  if (controller.value != null) {
    controller.value.abort()
  }
  pickerStation.value = null
})


</script>

<template>
  <PickerToolbar
    v-model="toolbarValue"
    :time="props.time"
    :latitude="props.latitude"
    :longitude="props.longitude"
    :no-event="props.noEvent"
    @leave="emit('update:modelValue', false)"
    @download-channels="downloadChannels"/>
  <div
    :style="{ height: 'calc(100vh - 80px)' }"
    class="d-flex flex-column"
    @mouseup="endDragging"
    @mouseleave="endDragging"
  >
    <PickerWaveforms
      :data="data"
      :active-station="pickerStation"
      :station-ref-times="stationRefTimes"
      :ref-time-key="toolbarValue.alignment"
      :phase="toolbarValue.phase"
      :denoiser="toolbarValue.denoiser"
      :detector="toolbarValue.detector"
      :spectrogram="toolbarValue.spectrogram"
      :rotation="toolbarValue.rotation"
      :filter="filterValue"
      :controller="controller"
      :common-scale="toolbarValue.commonScale"
      :integration="toolbarValue.integration"
      :hide-ref-times="props.noEvent"
      :time-window="sliderTimeWindow"
      :ttt-enabled="toolbarValue.tttEnabled"
      :style="{ height: `${resizerPosition}%` }"
      @active-channel="handleActiveChannel"
      @create-pick="createPick"
      @select-picks="handleSelectPicks"
      @picker-time="(t: number) => pickerTime = t"
      @updateTimeWindow="(tw: [number, number]) => pickerTimeWindow = tw"/>
    <div @mousedown="startDragging" :style="{ height: '12px', cursor: 'ns-resize', textAlign: 'center' }"></div>
    <v-card :style="{ overflowY: 'auto', height: `calc(${100 - resizerPosition}% - 12px)` }">
      <v-card-text>
        <PickerWaveformList
          :data="data"
          :sort-trace="toolbarValue.sort"
          :station-ref-times="stationRefTimes"
          :ref-time-key="toolbarValue.alignment"
          :filter="filterValue"
          :time-window="pickerTimeWindow"
          :hide-ref-times="props.noEvent"
          :detector="toolbarValue.detector"
          @select-station="handleSelectStation"
          @sliderTimeWindow="(tw: [number, number]) => sliderTimeWindow = tw"/>
      </v-card-text>
    </v-card>
  </div>
  <v-menu
    v-model="contextMenu"
    attach
    :target="contextMenuPos"
    z-index="4000"
    :style="{ position: 'absolute', top: `${contextMenuPos[1]}px`, left: `${contextMenuPos[0]}px` }"
    :transition="false"
  >
    <v-card v-if="selectedPicks.length > 0" width="250">
      <v-card-text>
        <v-list density="compact">
          <v-list-subheader>Polarity</v-list-subheader>
          <v-list-item prepend-icon="mdi-arrow-up-bold" @click="setPickPolarity('positive')" :append-icon="selectedPicks[0].polarity === 'positive' ? 'mdi-check' : ''">positive</v-list-item>
          <v-list-item prepend-icon="mdi-arrow-down-bold" @click="setPickPolarity('negative')" :append-icon="selectedPicks[0].polarity === 'negative' ? 'mdi-check' : ''">negative</v-list-item>
          <v-list-item prepend-icon="mdi-help" @click="setPickPolarity('undecidable')" :append-icon="selectedPicks[0].polarity === 'undecidable' ? 'mdi-check' : ''">undecidable</v-list-item>
          <v-divider></v-divider>
          <v-list-subheader>Onset</v-list-subheader>
          <v-list-item prepend-icon="mdi-pulse" @click="setPickOnset('impulsive')" :append-icon="selectedPicks[0].onset === 'impulsive' ? 'mdi-check' : ''">impulsive</v-list-item>
          <v-list-item prepend-icon="mdi-tilde" @click="setPickOnset('emergent')" :append-icon="selectedPicks[0].onset === 'emergent' ? 'mdi-check' : ''">emergent</v-list-item>
          <v-list-item prepend-icon="mdi-help" @click="setPickOnset('undecidable')" :append-icon="selectedPicks[0].onset === 'undecidable' ? 'mdi-check' : ''">undecidable</v-list-item>            
          <v-divider></v-divider>
          <v-list-subheader>Status</v-list-subheader>
          <v-list-item @click="setPickEvaluationStatus('confirmed')" :append-icon="selectedPicks[0].evaluationStatus === 'confirmed' ? 'mdi-check' : ''">
            <template #prepend>
              <v-badge inline content="C"></v-badge>
            </template>
            confirmed
          </v-list-item>
          <v-list-item @click="setPickEvaluationStatus('final')" :append-icon="selectedPicks[0].evaluationStatus === 'final' ? 'mdi-check' : ''">
            <template #prepend>
              <v-badge inline content="F"></v-badge>
            </template>
            final
          </v-list-item>
          <v-list-item @click="setPickEvaluationStatus('preliminary')" :append-icon="selectedPicks[0].evaluationStatus === 'preliminary' ? 'mdi-check' : ''">
            <template #prepend>
              <v-badge inline content="P"></v-badge>
            </template>
            preliminary
          </v-list-item>
          <v-list-item @click="setPickEvaluationStatus('rejected')" :append-icon="selectedPicks[0].evaluationStatus === 'rejected' ? 'mdi-check' : ''">
            <template #prepend>
              <v-badge inline content="Rej"></v-badge>
            </template>
            rejected
          </v-list-item>
          <v-list-item @click="setPickEvaluationStatus('reviewed')" :append-icon="selectedPicks[0].evaluationStatus === 'reviewed' ? 'mdi-check' : ''">
            <template #prepend>
              <v-badge inline content="rev"></v-badge>
            </template>
            reviewed
          </v-list-item>
          <v-divider></v-divider>
          <v-list-subheader>Uncertainty</v-list-subheader>
          <v-list-item prepend-icon="mdi-close" @click="setPickUncertainty(0)">remove uncertainty</v-list-item>
          <v-divider></v-divider>
          <v-list-item prepend-icon="mdi-delete" @click="deleteSelectedPicks">delete pick</v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </v-menu>
</template>
