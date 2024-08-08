<script setup lang="ts">
// import type { Arrival } from '@/lib/sismojs/src/types'
import { Arrival } from '@/lib/sismojs/src/core/event/types'
import { useAppStore } from '@/stores/app'
import type { ColObject } from '@/types'
import { ref, watch } from 'vue'

const store = useAppStore()

const selected = ref([] as Arrival[])

const arrivalCols = ref([
  {
    label: 'Status',
    valueAccessor: (a: Arrival) => a.pickID.referredObject.evaluationMode,
    textAccessor: (a: Arrival) => a.pickID.referredObject.evaluationMode === 'manual' ? 'M' : 'A',
    class: (a: Arrival) => a.pickID.referredObject.evaluationMode === 'manual' ? 'text-green' : 'text-red',
    enabled: true
  },
  {
    label: 'Phase',
    valueAccessor: (a: Arrival) => a.pickID.referredObject.phaseHint,
    textAccessor: (a: Arrival) => a.pickID.referredObject.phaseHint,
    enabled: true
  },
  {
    label: 'Net',
    valueAccessor: (a: Arrival) => a.pickID.referredObject.waveformID.networkCode,
    textAccessor: (a: Arrival) => a.pickID.referredObject.waveformID.networkCode,
    enabled: true
  },
  {
    label: 'Sta',
    valueAccessor: (a: Arrival) => a.pickID.referredObject.waveformID.stationCode,
    textAccessor: (a: Arrival) => a.pickID.referredObject.waveformID.stationCode,
    enabled: true
  },
  {
    label: 'Loc',
    valueAccessor: (a: Arrival) => a.pickID.referredObject.waveformID.locationCode || '--',
    textAccessor: (a: Arrival) => a.pickID.referredObject.waveformID.locationCode || '--',
    enabled: true
  },
  {
    label: 'Cha',
    valueAccessor: (a: Arrival) => a.pickID.referredObject.waveformID.channelCode,
    textAccessor: (a: Arrival) => a.pickID.referredObject.waveformID.channelCode,
    enabled: true
  },
  {
    label: 'Takeoff [°]',
    valueAccessor: (a: Arrival) => a.takeoffAngle,
    textAccessor: (a: Arrival) => a.takeoffAngle?.toFixed(2),
    enabled: true
  },
  {
    label: 'Polarity',
    valueAccessor: (a: Arrival) => a.pickID.referredObject.polarity,
    textAccessor: (a: Arrival) => a.pickID.referredObject.polarity,
    enabled: true
  },
  {
    label: 'Res [s]',
    valueAccessor: (a: Arrival) => a.timeResidual,
    textAccessor: (a: Arrival) => a.timeResidual?.toFixed(2),
    enabled: true
  },
  {
    label: 'Dist [°]',
    valueAccessor: (a: Arrival) => a.distance,
    textAccessor: (a: Arrival) => a.distance?.toFixed(2),
    enabled: true
  },
  {
    label: 'Az [°]',
    valueAccessor: (a: Arrival) => a.azimuth,
    textAccessor: (a: Arrival) => a.azimuth != null ? a.azimuth.toFixed(2) : '',
    enabled: true
  },
  {
    label: 'Weight',
    valueAccessor: (a: Arrival) => a.timeWeight,
    textAccessor: (a: Arrival) => a.timeWeight?.toFixed(2),
    enabled: true
  },
  {
    label: 'Time',
    valueAccessor: (a: Arrival) => traveltime(a),
    textAccessor: (a: Arrival) => traveltime(a),
    enabled: true
  },
  {
    label: 'Uncert [s]',
    valueAccessor: (a: Arrival) => a.pickID.referredObject.time.uncertainty,
    textAccessor: (a: Arrival) => a.pickID.referredObject.time.uncertainty,
    enabled: false
  }
] as ColObject[])

watch(() => store.currentArrivals, setSelected, { immediate: true })

function traveltime(a: Arrival) {
  if (store.currentOrigin == null) {
    return null
  }
  return new Date(a.pickID.referredObject.time.object.getTime() - store.currentOrigin.time.object.getTime()).toISOString().slice(0, 19).split('T')[1]
}

function handleSelection (selected: Arrival[]) {
  store.selectArrivals(selected)
}

function setSelected() {
  if (store.currentArrivals == null) {
    return
  }
  selected.value = store.currentArrivals.filter(x => x.timeWeight != null && x.timeWeight > 0) as Arrival[]
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
      store-key="arrivalPanel"
    ></SmartTable>
  </v-card>
</template>