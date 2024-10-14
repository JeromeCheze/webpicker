<script setup lang="ts">
// import type { Arrival } from '@/lib/sismojs/src/types'
import { QArrival } from '@/lib/sismojs/src/core/event/types'
import { useAppStore } from '@/stores/app'
import SmartTable from './SmartTable.vue'
import type { ColObject } from '@/types'
import { ref, watch } from 'vue'

const store = useAppStore()

const selected = ref([] as QArrival[])

const arrivalCols = ref([
  {
    label: 'Status',
    valueAccessor: (a: QArrival) => a.pickID.referredObject.evaluationMode,
    textAccessor: (a: QArrival) => a.pickID.referredObject.evaluationMode === 'manual' ? 'M' : 'A',
    class: (a: QArrival) => a.pickID.referredObject.evaluationMode === 'manual' ? 'text-green' : 'text-red',
    enabled: true
  },
  {
    label: 'Phase',
    valueAccessor: (a: QArrival) => a.pickID.referredObject.phaseHint,
    textAccessor: (a: QArrival) => a.pickID.referredObject.phaseHint,
    enabled: true
  },
  {
    label: 'Net',
    valueAccessor: (a: QArrival) => a.pickID.referredObject.waveformID.networkCode,
    textAccessor: (a: QArrival) => a.pickID.referredObject.waveformID.networkCode,
    enabled: true
  },
  {
    label: 'Sta',
    valueAccessor: (a: QArrival) => a.pickID.referredObject.waveformID.stationCode,
    textAccessor: (a: QArrival) => a.pickID.referredObject.waveformID.stationCode,
    enabled: true
  },
  {
    label: 'Loc',
    valueAccessor: (a: QArrival) => a.pickID.referredObject.waveformID.locationCode || '--',
    textAccessor: (a: QArrival) => a.pickID.referredObject.waveformID.locationCode || '--',
    enabled: true
  },
  {
    label: 'Cha',
    valueAccessor: (a: QArrival) => a.pickID.referredObject.waveformID.channelCode,
    textAccessor: (a: QArrival) => a.pickID.referredObject.waveformID.channelCode,
    enabled: true
  },
  {
    label: 'Takeoff [°]',
    valueAccessor: (a: QArrival) => a.takeoffAngle,
    textAccessor: (a: QArrival) => a.takeoffAngle?.toFixed(2),
    enabled: true
  },
  {
    label: 'Polarity',
    valueAccessor: (a: QArrival) => a.pickID.referredObject.polarity,
    textAccessor: (a: QArrival) => a.pickID.referredObject.polarity,
    enabled: true
  },
  {
    label: 'Res [s]',
    valueAccessor: (a: QArrival) => a.timeResidual,
    textAccessor: (a: QArrival) => a.timeResidual?.toFixed(2),
    enabled: true
  },
  {
    label: 'Dist [°]',
    valueAccessor: (a: QArrival) => a.distance,
    textAccessor: (a: QArrival) => a.distance?.toFixed(2),
    enabled: true
  },
  {
    label: 'Az [°]',
    valueAccessor: (a: QArrival) => a.azimuth,
    textAccessor: (a: QArrival) => a.azimuth != null ? a.azimuth.toFixed(2) : '',
    enabled: true
  },
  {
    label: 'Weight',
    valueAccessor: (a: QArrival) => a.timeWeight,
    textAccessor: (a: QArrival) => a.timeWeight?.toFixed(2),
    enabled: true
  },
  {
    label: 'Time',
    valueAccessor: (a: QArrival) => traveltime(a),
    textAccessor: (a: QArrival) => traveltime(a),
    enabled: true
  },
  {
    label: 'Uncert [s]',
    valueAccessor: (a: QArrival) => a.pickID.referredObject.time.uncertainty,
    textAccessor: (a: QArrival) => a.pickID.referredObject.time.uncertainty,
    enabled: false
  }
] as ColObject[])

watch(() => store.currentArrivals, setSelected, { immediate: true })

function traveltime(a: QArrival) {
  if (store.currentOrigin == null) {
    return null
  }
  return new Date(a.pickID.referredObject.time.object.getTime() - store.currentOrigin.time.object.getTime()).toISOString().slice(0, 19).split('T')[1]
}

function handleSelection (selected: QArrival[]) {
  store.selectArrivals(selected)
}

function setSelected() {
  if (store.currentArrivals == null) {
    return
  }
  selected.value = store.currentArrivals.filter(x => x.timeWeight != null && x.timeWeight > 0) as QArrival[]
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