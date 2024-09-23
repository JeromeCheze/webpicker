<script setup lang="ts">
import type { FilterOptions, PickerToolbarOptions } from '@/types'
import { blurActiveElement } from '@/utils'
import { ref, watch, computed } from 'vue'
import { useAppStore } from '@/stores/app'

const emit = defineEmits(['leave', 'downloadChannels'])

const props = defineProps<{
  time: number
  latitude: number
  longitude: number
  modelValue: PickerToolbarOptions
  noEvent: boolean
}>()

const store = useAppStore()

const phases = ['P', 'S']
const alignments = ['O', 'P', 'S']
const sortOptions = [
  { value: 'distance', icon: 'mdi-map-marker-distance' },
  { value: 'name', icon: 'mdi-sort-alphabetical-ascending' }
]

const filters = computed(() => store.settings['filter'].map((x: FilterOptions) => x.name))

const phase = ref()
const stationRadiusMenu = ref(false)
const alignment = ref(alignments.indexOf(props.modelValue.alignment))
const sortValue = ref(sortOptions.indexOf(sortOptions.find(x => x.value === props.modelValue.sort)!))
const lastFilter = ref(filters.value[0])

const rotationDisabled = computed(() => {
  return props.modelValue.components.indexOf('N') < 0 || props.modelValue.components.indexOf('E') < 0
})

function toggleDenoiser() {
  props.modelValue.denoiser = !props.modelValue.denoiser
}

function toogleSpectrogram() {
  props.modelValue.spectrogram = !props.modelValue.spectrogram
}

function toggleDetector() {
  props.modelValue.detector = !props.modelValue.detector
}

function toggleIntegration() {
  props.modelValue.integration = !props.modelValue.integration
}

function toggleCommonScale() {
  props.modelValue.commonScale = !props.modelValue.commonScale
}

function toggleRotation() {
  props.modelValue.rotation = props.modelValue.rotation === 'ZRT' ? 'ZNE' : 'ZRT'
}

watch(() => store.keydown, (newValue) => {
  // console.log(newValue)
  if (newValue === store.settings['keybinding.setPhaseP']) {
    phase.value = 0
  } else if (newValue === store.settings['keybinding.setPhaseS']) {
    phase.value = 1
  } else if (newValue === store.settings['keybinding.toggleFilter']) {
    props.modelValue.filter = props.modelValue.filter == null ? lastFilter.value : null
  } else if (!props.noEvent && newValue === store.settings['keybinding.alignToOrigin']) {
    alignment.value = 0
  } else if (!props.noEvent && newValue === store.settings['keybinding.alignToP']) {
    alignment.value = 1
  } else if (!props.noEvent && newValue === store.settings['keybinding.alignToS']) {
    alignment.value = 2
  } else if (newValue === store.settings['keybinding.toggleDenoiser']) {
    toggleDenoiser()
  } else if (newValue === store.settings['keybinding.toggleSpectrogram']) {
    toogleSpectrogram()
  } else if (newValue === store.settings['keybinding.toggleDetector']) {
    toggleDetector()
  } else if (newValue === store.settings['keybinding.toggleIntegration']) {
    toggleIntegration()
  } else if (newValue === store.settings['keybinding.toggleCommonScale']) {
    toggleCommonScale()
  } else if (newValue === store.settings['keybinding.toggleRotation']) {
    toggleRotation()
  }
})

watch(() => props.modelValue.filter, (value) => {
  blurActiveElement()
  if (value != null) {
    lastFilter.value = value
  }
})

watch(() => phase.value, (value: number | undefined) => props.modelValue.phase = value != undefined ? phases[value] as 'P' | 'S' : undefined)
watch(() => alignment.value, (value: number) => props.modelValue.alignment = alignments[value] as PickerToolbarOptions['alignment'])
watch(() => sortValue.value, (value: number) => props.modelValue.sort = sortOptions[value].value as 'distance' | 'name')
</script>

<template>
  <v-app-bar density="compact">
    <!-- PHASE SELECTOR -->
    <v-btn-toggle v-model="phase" class="ml-2 mr-1" density="compact" variant="outlined">
      <v-btn :title="`Set phase P (${store.settings['keybinding.setPhaseP']})`">P</v-btn>
      <v-btn :title="`Set phase S (${store.settings['keybinding.setPhaseS']})`">S</v-btn>
    </v-btn-toggle>
    <!-- DENOISER SWITCH -->
    <v-btn
      :title="`Toggle denoiser (${store.settings['keybinding.toggleDenoiser']})`"
      @click="toggleDenoiser"
      :active="props.modelValue.denoiser"
      class="mx-1">
      <v-icon>mdi-broom</v-icon>
    </v-btn>
    <!-- INTEGRATION SWITCH -->
    <v-btn
      :title="`Toggle integration (${store.settings['keybinding.toggleIntegration']})`"
      @click="toggleIntegration"
      :active="props.modelValue.integration"
      class="mx-1">∫</v-btn>
    <!-- ROTATION SELECTOR -->
    <v-btn
      :title="`Toggle ZRT rotation (${store.settings['keybinding.toggleRotation']})`"
      :active="props.modelValue.rotation === 'ZRT'"
      :disabled="rotationDisabled"
      @click="toggleRotation"
      class="mx-1">ZRT</v-btn>
    <!-- FILTER SELECTOR -->
    <v-select
      density="compact"
      hide-details
      clearable
      :items="filters"
      v-model="props.modelValue.filter"
      label="Filter"
      class="mx-1"></v-select>
    <!-- SPECTROGRAM -->
    <v-btn
      :title="`Toggle spectrogram (${store.settings['keybinding.toggleSpectrogram']})`"
      :active="props.modelValue.spectrogram"
      @click="toogleSpectrogram"
      class="mx-1">Hz</v-btn>
    <!-- DETECTOR -->
    <v-btn
      :title="`Toggle detector (${store.settings['keybinding.toggleDetector']})`"
      :active="props.modelValue.detector"
      @click="toggleDetector"
      class="mx-1">D</v-btn>
    <!-- COMMON SCALE -->
    <v-btn
      :title="`Toggle common scale (${store.settings['keybinding.toggleCommonScale']})`"
      :active="props.modelValue.commonScale"
      @click="toggleCommonScale"
      class="mx-1">
      <v-icon>mdi-ruler</v-icon>
    </v-btn>
    <!-- TIME ALIGNMENT -->
    <v-btn-toggle v-model="alignment" class="mx-1" density="compact" mandatory variant="outlined" v-if="!props.noEvent">
      <v-btn :title="`Align to origin (${store.settings['keybinding.alignToOrigin']})`">O</v-btn>
      <v-btn :title="`Align to P (${store.settings['keybinding.alignToP']})`">P</v-btn>
      <v-btn :title="`Align to S (${store.settings['keybinding.alignToS']})`">S</v-btn>
    </v-btn-toggle>
    <!-- SORT -->
    <v-btn-toggle v-model="sortValue" class="mx1" density="compact" mandatory variant="outlined">
      <v-btn v-for="curr in sortOptions" :title="`Sort stations by ${curr.value}`"><v-icon>{{ curr.icon }}</v-icon></v-btn>
    </v-btn-toggle>
    <!-- ADDITIONAL CHANNELS -->
    <AdditionalChannels :seedids="props.modelValue.seedids" @additional-channels="(seedidList: string[]) => emit('downloadChannels', seedidList)"/>
    <!-- STATION RADIUS -->
    <v-menu v-model="stationRadiusMenu" :close-on-content-click="false" attach>
      <template v-slot:activator="{ props }">
        <v-btn class="mx-1" v-bind="props" title="Add station radius"><v-icon>mdi-less-than-or-equal</v-icon></v-btn>
      </template>
      <v-card min-width="500">
        <v-card-text>
          <StationRadius
            v-model="stationRadiusMenu"
            storage-key="pickerStationRadius-v2"
            :time="props.time"
            :latitude="props.latitude"
            :longitude="props.longitude"
            @radius-stations="(seedidList: string[]) => emit('downloadChannels', seedidList)"/>
        </v-card-text>
      </v-card>
    </v-menu>
    <!-- EXIT -->
    <v-btn @click="emit('leave')" :title="`Exit picker [${store.settings['keybinding.togglePicker']}]`" class="ml-1 mr-2"><v-icon>mdi-exit-to-app</v-icon></v-btn>
  </v-app-bar>
</template>