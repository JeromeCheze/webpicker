<script setup lang="ts">
import type { Arrival } from '@/lib/sismojs/src/types'
import { useAppStore } from '@/stores/app'
import type { ColObject } from '@/types'
import { ref, watch } from 'vue'

const store = useAppStore()

const selected = ref([] as Arrival[])

const arrivalCols = ref([
  {
    label: 'Status',
    valueAccessor: (a: Arrival) => a._pick?.evaluation_mode,
    textAccessor: (a: Arrival) => a._pick?.evaluation_mode === 'manual' ? 'M' : 'A',
    class: (a: Arrival) => a._pick?.evaluation_mode === 'manual' ? 'text-green' : 'text-red',
    enabled: true
  },
  {
    label: 'Phase',
    valueAccessor: (a: Arrival) => a._pick?.phase_hint,
    textAccessor: (a: Arrival) => a._pick?.phase_hint,
    enabled: true
  },
  {
    label: 'Net',
    valueAccessor: (a: Arrival) => a._pick?.waveform_id.network_code,
    textAccessor: (a: Arrival) => a._pick?.waveform_id.network_code,
    enabled: true
  },
  {
    label: 'Sta',
    valueAccessor: (a: Arrival) => a._pick?.waveform_id.station_code,
    textAccessor: (a: Arrival) => a._pick?.waveform_id.station_code,
    enabled: true
  },
  {
    label: 'Loc',
    valueAccessor: (a: Arrival) => a._pick?.waveform_id.location_code || '--',
    textAccessor: (a: Arrival) => a._pick?.waveform_id.location_code || '--',
    enabled: true
  },
  {
    label: 'Cha',
    valueAccessor: (a: Arrival) => a._pick?.waveform_id.channel_code,
    textAccessor: (a: Arrival) => a._pick?.waveform_id.channel_code,
    enabled: true
  },
  {
    label: 'Takeoff [°]',
    valueAccessor: (a: Arrival) => a.takeoff_angle,
    textAccessor: (a: Arrival) => a.takeoff_angle,
    enabled: true
  },
  {
    label: 'Polarity',
    valueAccessor: (a: Arrival) => a._pick?.polarity,
    textAccessor: (a: Arrival) => a._pick?.polarity,
    enabled: true
  },
  {
    label: 'Res',
    valueAccessor: (a: Arrival) => a.time_residual,
    textAccessor: (a: Arrival) => a.time_residual.toFixed(2),
    enabled: true
  },
  {
    label: 'Dist',
    valueAccessor: (a: Arrival) => a.distance,
    textAccessor: (a: Arrival) => a.distance.toFixed(2),
    enabled: true
  },
  {
    label: 'Az',
    valueAccessor: (a: Arrival) => a.azimuth,
    textAccessor: (a: Arrival) => a.azimuth.toFixed(2),
    enabled: true
  },
  {
    label: 'Weight',
    valueAccessor: (a: Arrival) => a.time_weight,
    textAccessor: (a: Arrival) => a.time_weight.toFixed(2),
    enabled: true
  },
  {
    label: 'Time',
    valueAccessor: (a: Arrival) => a._traveltime,
    textAccessor: (a: Arrival) => a._traveltime.toISOString().slice(0, 19).split('T')[1],
    enabled: true
  },
] as ColObject[])

watch(() => store.currentArrivals, () => {
  setSelected()
}, { immediate: true })

function handleSelection (selected: Arrival[]) {
  store.selectArrivals(selected)
}

function setSelected() {
  if (store.currentArrivals == null) {
    return
  }
  selected.value = store.currentArrivals.filter(x => x.time_weight > 0)
}
</script>

<template>
  <v-card v-if="store.currentArrivals != null">
    <v-card-title>Phases</v-card-title>
    <SmartTable
      :cols="arrivalCols"
      :items="store.currentArrivals"
      :table-height="300"
      :sort-col="9"
      sort-order="asc"
      selectable
      :selected="selected"
      @selection="handleSelection"
    ></SmartTable>
  </v-card>
</template>