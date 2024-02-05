<script setup lang="ts">
import type { PickerToolbarOptions } from '@/types'
import { useAppStore } from '@/stores/app'
import { ref, watch } from 'vue'

const emit = defineEmits(['leave'])

const props = defineProps<{
  modelValue: PickerToolbarOptions
}>()

const store = useAppStore()

const phases = ['P', 'S']
const alignments = ['O', 'P', 'S']
const rotations = ['ZNE', 'ZRT']
const sortOptions = [
  { value: 'distance', icon: 'mdi-map-marker-distance' },
  { value: 'name', icon: 'mdi-sort-alphabetical-ascending' },
]

const phase = ref()
const alignment = ref(alignments.indexOf(props.modelValue.alignment))
const component = ref(props.modelValue.components.indexOf(props.modelValue.component))
const sortValue = ref(sortOptions.indexOf(sortOptions.find(x => x.value === props.modelValue.sort)!))
const rotation = ref(rotations.indexOf(props.modelValue.rotation))
const lastFilter = ref(props.modelValue.filters[0])

watch(() => store.keydown, (newValue) => {
  // console.log(newValue)
  if (newValue === store.settings.KEYBINDING.SET_PHASE_P) {
    phase.value = 0
  } else if (newValue === store.settings.KEYBINDING.SET_PHASE_S) {
    phase.value = 1
  } else if (newValue === store.settings.KEYBINDING.TOGGLE_FILTER) {
    props.modelValue.filter = props.modelValue.filter == null ? lastFilter.value : null
  } else if (newValue === store.settings.KEYBINDING.ALIGN_TO_ORIGIN) {
    alignment.value = 0
  } else if (newValue === store.settings.KEYBINDING.ALIGN_TO_P) {
    alignment.value = 1
  } else if (newValue === store.settings.KEYBINDING.ALIGN_TO_S) {
    alignment.value = 2
  }
})

watch (() => props.modelValue.filter, (value) => {
  if (value != null) {
    lastFilter.value = value
  }
})

watch(() => phase.value, (value: number | undefined) => props.modelValue.phase = value != undefined ? phases[value] as 'P' | 'S' : undefined)
watch(() => alignment.value, (value: number) => props.modelValue.alignment = alignments[value])
watch(() => component.value, (value: number) => props.modelValue.component = props.modelValue.components[value])
watch(() => sortValue.value, (value: number) => props.modelValue.sort = sortOptions[value].value as 'distance' | 'name')
watch(() => rotation.value, (value: number) => props.modelValue.rotation = rotations[value] as 'ZNE' | 'ZRT')

watch(() => props.modelValue.component, (value) => component.value = props.modelValue.components.indexOf(value))
</script>

<template>
  <v-toolbar density="compact">
    <v-btn-toggle v-model="phase" class="ml-4" density="compact">
      <v-btn v-for="curr in phases">{{ curr }}</v-btn>
    </v-btn-toggle>
    <v-select
      density="compact"
      hide-details
      clearable
      :items="props.modelValue.filters"
      v-model="props.modelValue.filter"
      label="Filter"
      class="ml-4"
    ></v-select>
    <v-btn-toggle v-model="alignment" class="ml-4" density="compact" mandatory>
      <v-btn v-for="curr in alignments">{{ curr }}</v-btn>
    </v-btn-toggle>
    <v-btn-toggle v-model="component" class="ml-4" density="compact">
      <v-btn v-for="curr in props.modelValue.components">{{ curr }}</v-btn>
    </v-btn-toggle>
    <v-btn-toggle v-model="sortValue" class="ml-4" density="compact" mandatory>
      <v-btn v-for="curr in sortOptions"><v-icon>{{ curr.icon }}</v-icon></v-btn>
    </v-btn-toggle>
    <v-btn class="ml-4"><v-icon>mdi-less-than-or-equal</v-icon></v-btn>
    <v-btn-toggle v-model="rotation" class="mx-4" density="compact">
      <v-btn v-for="curr in rotations">{{ curr }}</v-btn>
    </v-btn-toggle>
    <v-btn @click="emit('leave')"><v-icon>mdi-exit-to-app</v-icon></v-btn>
  </v-toolbar>
</template>