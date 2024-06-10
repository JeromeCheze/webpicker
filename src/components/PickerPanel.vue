<script setup lang="ts">
import type { FilterOptions, PickerToolbarOptions, StationRefTimes, WPNotificationOptions } from '@/types'
import { Pick, type PickOnset, type PickPolarity } from '@/lib/sismojs/src/core/event/types'
import type { Trace } from '@/lib/sismojs/src/core/waveform'
import { ref, watch, onMounted, computed } from 'vue'
import { pushUnique, toNetSta } from '@/utils'
import { useAppStore } from '@/stores/app'
import { onBeforeUnmount } from 'vue'

const TRACE_SORT_RULES = ['Z', 'N', '1', 'E', '2', '3', 'H']

const emit = defineEmits(['update:modelValue'])

const props = defineProps<{
  modelValue: boolean
}>()

const store = useAppStore()
console.log(store.dataManager)

const contextMenu = ref(false)
const contextMenuPos = ref([0, 0])
const controller = ref(new AbortController())
const data = ref([] as Trace[])

const pickerStation = ref(null as string | null)
const activeChannel = ref(null as string | null)
const selectedPicks = ref([] as Pick[])
const pickerTime = ref(null as number | null)

const toolbarValue = ref({
  phase: undefined,
  alignment: 'O',
  component: '',
  components: [],
  sort: 'distance',
  filter: null,
  rotation: 'ZNE',
  denoiser: false,
  spectrogram: false,
  detector: false
} as PickerToolbarOptions)

const stationRefTimes = ref({} as StationRefTimes)

const filterValue = computed(() => {
  if (toolbarValue.value.filter != null) {
    return store.settings['filter'].find((x: FilterOptions) => x.name === toolbarValue.value.filter)
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
  const t0 = store.currentOrigin!.time.object.getTime()
  for (const tr of response) {
    const netsta = `${tr.stats.network}.${tr.stats.station}`
    if (stationRefTimes.value[netsta] == null) {
      stationRefTimes.value[netsta] = {
        O: t0,
        P: store.dataManager.getStationPhaseTime(store.currentOrigin!, netsta, 'P'),
        S: store.dataManager.getStationPhaseTime(store.currentOrigin!, netsta, 'S')
      }
      const pNLL = store.dataManager.getNLLStationPhaseTime(store.currentOrigin!, netsta, 'P')
      if (pNLL != null) {
        stationRefTimes.value[netsta].P_NLL = pNLL
      }
      const sNLL = store.dataManager.getNLLStationPhaseTime(store.currentOrigin!, netsta, 'S')
      if (sNLL != null) {
        stationRefTimes.value[netsta].S_NLL = sNLL
      }
    }
  }
  const result = [...data.value, ...response]
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
  if (store.currentOrigin == null || store.currentArrivals == null || controller.value == null) {
    return
  }
  stationRefTimes.value = {}
  const pickList: Pick[] = store.currentArrivals.map(x => x.pickID.referredObject)
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
    '..', store.currentOrigin, seedidList,
    store.settings['miscellaneous.maxTrace'],
    controller.value.signal,
    processDataCallback, handleNotification)
}

function handleStationRadius(seedidList: string[]) {
  if (store.currentOrigin == null || controller.value == null) {
    return
  }
  store.dataManager.getData(
    '..', store.currentOrigin, seedidList,
    store.settings['miscellaneous.maxTrace'],
    controller.value.signal,
    processDataCallback, handleNotification)
}

function handleActiveChannel(seedid: string) {
  activeChannel.value = seedid
}

function handleSelectStation(netsta: string) {
  const components: string[] = []
  for (const tr of data.value) {
    const current = `${tr.stats.network}.${tr.stats.station}`
    if (current === netsta) {
      components.push(tr.stats.channel.slice(-1))
    }
  }
  toolbarValue.value.components = components
  pickerStation.value = netsta
}


function handleSelectPicks(pickids: string[]) {
  if (pickids.length === 0) {
    contextMenu.value = false
  }
  const picks: Pick[] = store.currentArrivals!
    .map(a => a.pickID.referredObject)
    .filter(p => pickids.indexOf(p.publicID) >= 0)
  selectedPicks.value = picks
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
  if (toolbarValue.value.filter != null) {
    filter.push(toolbarValue.value.filter)
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

function setPickPolarity(value?: PickPolarity) {
  if (selectedPicks.value.length > 0) {
    if (selectedPicks.value[0].polarity === value) {
      selectedPicks.value[0].polarity = undefined
    } else {
      selectedPicks.value[0].polarity = value
    }
  }
  store.updatePickMap()
}

function setPickOnset(value: PickOnset) {
  if (selectedPicks.value.length > 0) {
    if (selectedPicks.value[0].onset === value) {
      selectedPicks.value[0].onset = undefined
    } else {
      selectedPicks.value[0].onset = value
    }
  }
  store.updatePickMap()
}

watch(() => store.keydown, (value) => {
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
  data.value = []
  displayWaveforms()

})

onBeforeUnmount(() => {
  document.body.removeEventListener('contextmenu', handleContextMenu)
  if (controller.value != null) {
    controller.value.abort()
  }
  pickerStation.value = null
})
</script>

<template>
  <PickerToolbar v-model="toolbarValue" @leave="emit('update:modelValue', false)" @radius-stations="handleStationRadius"/>
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
        @active-channel="handleActiveChannel"
        @create-pick="createPick"
        @select-picks="handleSelectPicks"
        @picker-time="(t: number) => pickerTime = t"/>
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
        @select-station="handleSelectStation"/>
    </v-card-text>
  </v-card>
  <v-menu v-model="contextMenu" attach :target="contextMenuPos" z-index="4000" :style="{ position: 'absolute', top: `${contextMenuPos[1]}px`, left: `${contextMenuPos[0]}px` }">
    <v-card v-if="selectedPicks.length > 0">
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
        <v-list-item prepend-icon="mdi-delete" @click="deleteSelectedPicks">Delete</v-list-item>
      </v-list>
    </v-card>
  </v-menu>
</template>

<style>
.scrollable-container {
  overflow-y: auto;
}
</style>