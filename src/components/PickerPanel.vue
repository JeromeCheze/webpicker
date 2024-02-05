<script setup lang="ts">
import type { PickerToolbarOptions, StationRefTimes, FilterOptions, PickMap } from '@/types'
import type { Trace } from '@/lib/sismojs/src/core/waveform'
import { ref, watch, onMounted, computed } from 'vue'
import type { Pick } from '@/lib/sismojs/src/types'
import { getDefault, toNetSta } from '@/utils'
import { useAppStore } from '@/stores/app'
import L from 'leaflet'

const TRACE_SORT_RULES = ['Z', 'N', '1', 'E', '2', '3', 'H']

const emit = defineEmits(['update:modelValue'])

const props = defineProps<{
  modelValue: boolean
}>()

const store = useAppStore()
console.log(store.dataManager)

const controller = ref(null as AbortController | null)

const filters: FilterOptions[] = [
  { name: 'HP 1', type: 'highpass', fc: 1, order: 4 },
  { name: 'BP 0.5-8', type: 'bandpass', fc: [0.5, 8], order: 4 },
  { name: 'BP 1-8', type: 'bandpass', fc: [1, 8], order: 4 },
  { name: 'BP 1-10', type: 'bandpass', fc: [1, 10], order: 4 },
  { name: 'BP 1-50', type: 'bandpass', fc: [1, 50], order: 4 },
  { name: 'BP 2-10', type: 'bandpass', fc: [2, 10], order: 4 },
  { name: 'BP 2-20', type: 'bandpass', fc: [2, 20], order: 4 },
  { name: 'BP 4-20', type: 'bandpass', fc: [4, 20], order: 4 },
  { name: 'LP 4', type: 'lowpass', fc: 4, order: 4 },
  { name: 'LP 10', type: 'lowpass', fc: 10, order: 4 },
  { name: 'LP 25', type: 'lowpass', fc: 25, order: 4 }
]

const data = ref([] as Trace[])

const pickerStation = ref(null as string | null)

const activeChannel = ref(null as string | null)
const selectedPicks = ref([] as Pick[])
const pickerTime = ref(null as number | null)

const loading = ref(false)
const loadingText = ref('Loading...')

const toolbarValue = ref({
  phase: undefined,
  alignment: 'O',
  component: '',
  components: [],
  sort: 'distance',
  filters: filters.map(x => x.name),
  filter: null,
  rotation: 'ZNE'
} as PickerToolbarOptions)

const stationRefTimes = ref({} as StationRefTimes)
const stationDistance = ref({} as Record<string,number>)
const pickMap = ref({} as PickMap)

const filterValue = computed(() => {
  if (toolbarValue.value.filter != null) {
    return filters.find(x => x.name === toolbarValue.value.filter)
  }
  return null
})

function updatePickMap() {
  if (store.currentArrivals == null) {
    return
  }
  console.log('update pickMap')
  const result: PickMap = {}
  for (const arrival of store.currentArrivals) {
    const p = arrival._pick
    if (p != null) {
      const netsta = toNetSta(p._seedid)
      getDefault(result, netsta, {})
      getDefault(result[netsta], p._seedid, []).push(p)
    }
  }
  pickMap.value = result
}

function displayWaveforms() {
  if (store.currentOrigin == null || controller.value == null) {
    return
  }
  stationRefTimes.value = {}
  loading.value = true
  updatePickMap()
  const originPos = L.latLng(store.currentOrigin!.latitude.value, store.currentOrigin!.longitude.value)
  store.dataManager.getOriginData('..', store.currentOrigin, controller.value.signal, (response: Trace[]) => {
    const t0 = store.currentOrigin!.time._value!.getTime()
    for (const tr of response) {
      const netsta = `${tr.stats.network}.${tr.stats.station}`
      const staPos = store.dataManager.getStationPos(netsta)
      if (staPos) {
        getDefault(stationDistance.value, netsta, originPos.distanceTo([staPos.lat, staPos.lon]))
      }
      if (stationRefTimes.value[netsta] == null) {
        stationRefTimes.value[netsta] = {
          O: t0,
          P: t0 + store.dataManager.getStationPhaseTime(netsta, 'P') * 1e3,
          S: t0 + store.dataManager.getStationPhaseTime(netsta, 'S') * 1e3
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
    loading.value = false
  })
}

function handleActiveChannel(seedid: string) {
  activeChannel.value = seedid
  toolbarValue.value.component = seedid.slice(-1)
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
  toolbarValue.value.component = components[0]
  pickerStation.value = netsta
}

function handleSelectPicks(pickids: string[]) {
  const picks: Pick[] = store.currentArrivals!
    .map(a => a._pick!)
    .filter(p => pickids.indexOf(p.public_id) >= 0)
  selectedPicks.value = picks
}

function createPick() {
  if (pickerTime.value == null || activeChannel.value == null || toolbarValue.value.phase == null) {
    return
  }
  const netsta = toNetSta(activeChannel.value)
  if (pickMap.value[netsta] != null) {
    for (const pickList of Object.values(pickMap.value[netsta])) {
      for (const p of pickList) {
        if (p.phase_hint === toolbarValue.value.phase) {
          store.deletePick(p.public_id)
        }
      }
    }
  }
  store.createPick(
    toolbarValue.value.phase,
    pickerTime.value,
    activeChannel.value,
    toolbarValue.value.filter || undefined
  )
}

watch(() => store.keydown, (newValue) => {
  if (newValue === store.settings.KEYBINDING.PICK) {
    store.preventDefault()
    createPick()
  }
})

watch(() => props.modelValue, (value) => {
  if (value === true) {
    data.value = []
    controller.value = new AbortController()
    displayWaveforms()
  } else {
    if (controller.value != null) {
      controller.value.abort()
    }
    pickerStation.value = null
    loading.value = false
  }
})

watch(() => store.currentArrivals, updatePickMap)

onMounted(() => {
  pickerStation.value = null
})
</script>

<template>
  <v-dialog
    :model-value="props.modelValue"
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
    fullscreen
    :scrim="false"
    persistent
    :transition="false"
  >
    <v-card class="fancy-background">
      <PickerToolbar v-model="toolbarValue" @leave="emit('update:modelValue', false)"/>
      <v-card-text>
        <v-card>
          <v-card-text>
            <PickerWaveforms
              :data="data"
              :active-station="pickerStation"
              :station-ref-times="stationRefTimes"
              :station-distance="stationDistance"
              :ref-time-key="toolbarValue.alignment"
              :phase="toolbarValue.phase"
              :filter="filterValue"
              :pick-map="pickMap"
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
              :station-distance="stationDistance"
              :ref-time-key="toolbarValue.alignment"
              :pick-map="pickMap"
              :filter="filterValue"
              @select-station="handleSelectStation"/>
          </v-card-text>
        </v-card>
      </v-card-text>
    </v-card>
  </v-dialog>
  <v-overlay v-model="loading" class="align-center justify-center text-black">
    <v-progress-circular indeterminate color="black"></v-progress-circular>
    {{ loadingText }}
  </v-overlay>
</template>

<style>
.fancy-background {
  background: linear-gradient(153deg, rgba(255,133,0,1) 0%, rgba(79,21,120,1) 100%);
  /* background: #E3E9F0; */
}
.scrollable-container {
  overflow-y: auto;
}
</style>