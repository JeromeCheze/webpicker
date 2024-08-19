<script setup lang="ts">
import type { FilterOptions, PickerToolbarOptions, PickMap, StationRefTimes, WPNotificationOptions } from '@/types'
import { QResourceIdentifier, QPick, type QPickOnset, type QPickPolarity } from '@/lib/sismojs/src/core/event/types'
import { ref, shallowRef, watch, onMounted, computed } from 'vue'
import type { Trace } from '@/lib/sismojs/src/core/waveform'
import { Client } from '@/lib/sismojs/src/fdsn'
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
}>()

const store = useAppStore()
console.log(store.dataManager)

const client = new Client('..')

const contextMenu = ref(false)
const contextMenuPos = ref([0, 0] as [number, number])
const controller = shallowRef(new AbortController())
const data = ref([] as Trace[])

const pickerStation = ref(null as string | null)
const activeChannel = ref(null as string | null)
const selectedPicks = shallowRef([] as QPick[])
const pickerTime = ref(null as number | null)
const pickerTimeWindow = ref([0, 0] as [number, number])

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
  integration: false
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
      '..', store.settings['detector.model'], wfid!,
      new Date(start).toISOString().slice(0, 19),
      new Date(end).toISOString().slice(0, 19),
      store.settings['detector.pThreshold'],
      store.settings['detector.sThreshold'],
      controller.value!.signal
    )
  }
}

function processDataCallback(response: Trace[]) {
  const result = [...data.value]
  const seedIds = result.map(tr => tr.stats.id)
  for (const tr of response) {
    if (seedIds.indexOf(tr.stats.id) >= 0) {
      continue
    }
    result.push(tr)
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
  result.sort((a, b) => {
    const aa = TRACE_SORT_RULES.indexOf(a.stats.channel.slice(-1))
    const bb = TRACE_SORT_RULES.indexOf(b.stats.channel.slice(-1))
    return aa < bb ? -1 : aa > bb ? 1 : 0
  })
  data.value = result
}

function handleNotification(opt: WPNotificationOptions) {
  store.notification.push(opt)
}

function displayWaveforms() {
  if (store.currentArrivals == null || controller.value == null) {
    return
  }
  stationRefTimes.value = {}
  const pickList: QPick[] = store.currentArrivals.map(x => x.pickID.referredObject)
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
    '..', props.time, props.latitude, props.longitude, props.depth, seedidList,
    store.settings['miscellaneous.maxTrace'],
    [store.settings['miscellaneous.timewindow1'], store.settings['miscellaneous.timewindow2']],
    controller.value.signal,
    processDataCallback, handleNotification
  )
}

function downloadChannels(seedidList: string[]) {
  if (controller.value == null) {
    return
  }
  store.dataManager.getData(
    '..', props.time, props.latitude, props.longitude, props.depth, seedidList,
    store.settings['miscellaneous.maxTrace'],
    [props.timeWindow[0], props.timeWindow[1]],
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
    const picks: QPick[] = store.currentArrivals!
      .map(a => a.pickID.referredObject)
      .filter(p => pickids.indexOf(p.publicID) >= 0)
    selectedPicks.value = picks
    console.log('selectedPicks', picks[0])
  }
}

function createPick() {
  if (pickerTime.value == null || activeChannel.value == null || toolbarValue.value.phase == null) {
    return
  }
  const netsta = toNetSta(activeChannel.value)
  if (store.pickMap[netsta] != null) {
    for (const pickList of Object.values(store.pickMap[netsta])) {
      for (const pick of pickList) {
        if (pick.phaseHint === toolbarValue.value.phase) {
          store.deletePick(pick)
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
  const newPick = store.createPick(
    toolbarValue.value.phase,
    pickerTime.value,
    activeChannel.value,
    filter.length > 0 ? filter.join('+') : undefined
  )
  selectedPicks.value = [newPick]
}

function deleteSelectedPicks() {
  for (const pick of selectedPicks.value) {
    store.deletePick(pick)
  }
}

function handleContextMenu(e: MouseEvent) {
  e.preventDefault()
  console.log('contextmenu')
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
    if (selectedPicks.value[0].polarity === value) {
      selectedPicks.value[0].polarity = undefined
    } else {
      selectedPicks.value[0].polarity = value
    }
  }
  console.log(selectedPicks.value[0])
  store.updatePickMap()
}

function setPickOnset(value: QPickOnset) {
  if (selectedPicks.value.length > 0) {
    if (selectedPicks.value[0].onset === value) {
      selectedPicks.value[0].onset = undefined
    } else {
      selectedPicks.value[0].onset = value
    }
  }
  store.updatePickMap()
}

function setPickUncertainty(value: number) {
  if (selectedPicks.value.length > 0) {
    const p = selectedPicks.value[0]
    if (p.evaluationMode === 'automatic') {
      return
    }
    if (p.time.uncertainty === value) {
      p.time.uncertainty = undefined
    } else {
      if (value === 0) {
        p.time.uncertainty = undefined
      } else {
        p.time.uncertainty = parseFloat(value.toPrecision(5))
      }
    }
  }
  store.updatePickMap()
}

function loadAdditionalPicks() {
  // The mainKey of ResourceIdentifier MUST be set to an other value
  // to prevent modified objects to be overwritten by new load
  const saveMainKey = QResourceIdentifier.mainKey
  QResourceIdentifier.mainKey = 'sandbox'
  client.getEvents({
    format: 'xml',
    starttime: new Date(props.time - 3600e3).toISOString().slice(0, 19),
    endtime: new Date(props.time + 3600e3).toISOString().slice(0, 19),
    includeallorigins: true,
    includearrivals: true
  }).then((events) => {
    const additionalPickMap: PickMap = {}
    for (const event of events) {
      if (store.currentEvent != null && event.publicID === store.currentEvent.publicID) {
        continue
      }
      for (const pick of event.pick) {
        const netsta = pick.waveformID.netsta
        const seedid = pick.waveformID.seedid
        if (additionalPickMap[netsta] == null) {
          additionalPickMap[netsta] = {}
        }
        if (additionalPickMap[netsta][seedid] == null) {
          additionalPickMap[netsta][seedid] = []
        }
        additionalPickMap[netsta][seedid].push(pick)
      }
    }
    store.additionalPickMap = additionalPickMap
  }).finally(() => {
    // Restore the original mainKey of ResourceIdentifier
    QResourceIdentifier.mainKey = saveMainKey
  })
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
  }
})

watch([
  () => pickerStation.value,
  () => toolbarValue.value.detector
], () => handleDetector())

onMounted(() => {
  pickerStation.value = null
  document.body.addEventListener('contextmenu', handleContextMenu)
  document.body.addEventListener('click', handleClick)
  data.value = []
  if (props.noEvent && props.seedidList.length > 0) {
    downloadChannels(props.seedidList)
  } else {
    displayWaveforms()
  }
  loadAdditionalPicks()
})

onBeforeUnmount(() => {
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
  <v-card>
    <v-card-text>
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
        @active-channel="handleActiveChannel"
        @create-pick="createPick"
        @select-picks="handleSelectPicks"
        @picker-time="(t: number) => pickerTime = t"
        @updateTimeWindow="(tw: [number, number]) => pickerTimeWindow = tw"/>
    </v-card-text>
  </v-card>
  <v-card class="mt-3">
    <v-card-text>
      <PickerWaveformList
        :data="data"
        :sort-trace="toolbarValue.sort"
        :station-ref-times="stationRefTimes"
        :ref-time-key="toolbarValue.alignment"
        :filter="filterValue"
        :time-window="pickerTimeWindow"
        :hide-ref-times="props.noEvent"
        @select-station="handleSelectStation"/>
    </v-card-text>
  </v-card>
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
          <v-list-subheader>Uncertainty</v-list-subheader>
          <v-list-item prepend-icon="mdi-close" @click="setPickUncertainty(0)">remove</v-list-item>
          <v-divider></v-divider>
          <v-list-item prepend-icon="mdi-delete" @click="deleteSelectedPicks">delete pick</v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </v-menu>
</template>

<style>
.scrollable-container {
  overflow-y: auto;
}
</style>