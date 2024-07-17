<script setup lang="ts">
import type { FilterOptions, PickerToolbarOptions } from '@/types'
import { blurActiveElement } from '@/utils'
import { ref, watch, computed } from 'vue'
import { useAppStore } from '@/stores/app'

const emit = defineEmits(['leave', 'downloadChannels'])

const props = defineProps<{
  modelValue: PickerToolbarOptions
}>()

const store = useAppStore()

const phases = ['P', 'S']
const alignments = ['O', 'P', 'S']
const rotations = ['ZNE', 'ZRT']
const sortOptions = [
  { value: 'distance', icon: 'mdi-map-marker-distance' },
  { value: 'name', icon: 'mdi-sort-alphabetical-ascending' }
]

const filters = computed(() => store.settings['filter'].map((x: FilterOptions) => x.name))

const phase = ref()
const alignment = ref(alignments.indexOf(props.modelValue.alignment))
const sortValue = ref(sortOptions.indexOf(sortOptions.find(x => x.value === props.modelValue.sort)!))
const rotation = ref(rotations.indexOf(props.modelValue.rotation))
const lastFilter = ref(filters.value[0])

const rotationDisabled = computed(() => {
  return props.modelValue.components.indexOf('N') < 0 || props.modelValue.components.indexOf('E') < 0
})


watch(() => store.keydown, (newValue) => {
  // console.log(newValue)
  if (newValue === store.settings['keybinding.setPhaseP']) {
    phase.value = 0
  } else if (newValue === store.settings['keybinding.setPhaseS']) {
    phase.value = 1
  } else if (newValue === store.settings['keybinding.toggleFilter']) {
    props.modelValue.filter = props.modelValue.filter == null ? lastFilter.value : null
  } else if (newValue === store.settings['keybinding.alignToOrigin']) {
    alignment.value = 0
  } else if (newValue === store.settings['keybinding.alignToP']) {
    alignment.value = 1
  } else if (newValue === store.settings['keybinding.alignToS']) {
    alignment.value = 2
  } else if (newValue === store.settings['keybinding.toggleDenoiser']) {
    props.modelValue.denoiser = !props.modelValue.denoiser
  } else if (newValue === store.settings['keybinding.toggleSpectrogram']) {
    props.modelValue.spectrogram = !props.modelValue.spectrogram
  } else if (newValue === store.settings['keybinding.toggleRotation']) {
    rotation.value = rotations.indexOf(props.modelValue.rotation === 'ZNE' ? 'ZRT' : 'ZNE')
  }
})

watch (() => props.modelValue.filter, (value) => {
  blurActiveElement()
  if (value != null) {
    lastFilter.value = value
  }
})

watch(() => phase.value, (value: number | undefined) => props.modelValue.phase = value != undefined ? phases[value] as 'P' | 'S' : undefined)
watch(() => alignment.value, (value: number) => props.modelValue.alignment = alignments[value])
watch(() => sortValue.value, (value: number) => props.modelValue.sort = sortOptions[value].value as 'distance' | 'name')
watch(() => rotation.value, (value: number) => props.modelValue.rotation = rotations[value] as 'ZNE' | 'ZRT')
</script>

<template>
  <v-app-bar density="compact">
    <!-- PHASE SELECTOR -->
    <v-btn-toggle v-model="phase" class="ml-4" density="compact">
      <v-btn :title="`Set phase P (${store.settings['keybinding.setPhaseP']})`">P</v-btn>
      <v-btn :title="`Set phase S (${store.settings['keybinding.setPhaseS']})`">S</v-btn>
    </v-btn-toggle>
    <!-- DENOISER SWITCH -->
    <v-switch
      :title="`Toggle denoiser (${store.settings['keybinding.toggleDenoiser']})`"
      label="Denoiser"
      density="compact"
      inset
      color="blue"
      v-model="props.modelValue.denoiser"
      class="ml-4 mt-6"/>
    <!-- ROTATION SELECTOR -->
    <v-btn-toggle v-model="rotation" class="ml-4" density="compact" :disabled="rotationDisabled" mandatory>
      <v-btn v-for="curr in rotations">{{ curr }}</v-btn>
    </v-btn-toggle>
    <!-- FILTER SELECTOR -->
    <v-select
      density="compact"
      hide-details
      clearable
      :items="filters"
      v-model="props.modelValue.filter"
      label="Filter"
      class="ml-4"
    ></v-select>
    <!-- SPECTROGRAM -->
    <v-switch
      :title="`Toggle spectrogram (${store.settings['keybinding.toggleSpectrogram']})`"
      label="Spectrogram"
      density="compact"
      inset
      color="blue"
      v-model="props.modelValue.spectrogram"
      class="ml-4 mt-6"/>
    <!-- DETECTOR -->
    <v-switch
      :title="`Toggle detector`"
      label="Detector"
      density="compact"
      inset
      color="blue"
      v-model="props.modelValue.detector"
      class="ml-4 mt-6"/>
    <!-- TIME ALIGNMENT -->
    <v-btn-toggle v-model="alignment" class="ml-4" density="compact" mandatory>
      <v-btn :title="`Align to origin (${store.settings['keybinding.alignToOrigin']})`">O</v-btn>
      <v-btn :title="`Align to P (${store.settings['keybinding.alignToP']})`">P</v-btn>
      <v-btn :title="`Align to S (${store.settings['keybinding.alignToS']})`">S</v-btn>
    </v-btn-toggle>
    <!-- SORT -->
    <v-btn-toggle v-model="sortValue" class="ml-4" density="compact" mandatory>
      <v-btn v-for="curr in sortOptions" :title="`Sort stations by ${curr.value}`"><v-icon>{{ curr.icon }}</v-icon></v-btn>
    </v-btn-toggle>
    <!-- ADDITIONAL CHANNELS -->
    <AdditionalChannels :seedids="props.modelValue.seedids" @additional-channels="(seedidList: string[]) => emit('downloadChannels', seedidList)"/>
    <!-- STATION RADIUS -->
    <StationRadius @radius-stations="(seedidList: string[]) => emit('downloadChannels', seedidList)"/>
    <!-- EXIT -->
    <v-btn @click="emit('leave')" :title="`Exit picker [${store.settings['keybinding.togglePicker']}]`"><v-icon>mdi-exit-to-app</v-icon></v-btn>
  </v-app-bar>
</template>