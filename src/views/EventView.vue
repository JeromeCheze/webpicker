<script setup lang="ts">
import type { Arrival } from '@/lib/sismojs/src/types'
import type { CommitOptions, ComputeMagnitudesOptions } from '@/types'
import { onBeforeRouteLeave } from 'vue-router'
import { Client } from '@/lib/sismojs/src/fdsn'
import { ref, onMounted, watch } from 'vue'
import { useAppStore } from '@/stores/app'

const props = defineProps({
  eventid: String
})

const store = useAppStore()

const client = new Client('..')

const picker = ref(false)
const loading = ref(false)
const activeChart = ref('residual' as 'residual' | 'traveltime')

watch(() => store.keydown, (newValue) => {
  // console.log(newValue)
  if (newValue === 'alt+r') {
    relocate()
  } else if (newValue === 'alt+shift+p') {
    if (picker.value) {
      picker.value = false
    } else {
      enablePicker()
    }
  }
})

function relocate() {
  alert('relocate not implemented')
}

function computeMagnitudes(opt: ComputeMagnitudesOptions) {
  if (store.eventViewStatus.computeMagnitudesStatus === 'disabled') {
    return
  }
  alert('computeMagnitudes not implemented')
}

function commit(opt: CommitOptions) {
  if (store.eventViewStatus.commitStatus === 'disabled') {
    return
  }
  alert('commit not implemented')
}

function enablePicker() {
  store.cloneOrigin()
  picker.value = true
}

function select(value: string) {
  if (store.currentArrivals == null) {
    return
  }
  let selection: Arrival[] = []
  if (value === 'all') {
    selection = store.currentArrivals
  } else if (value === 'manual') {
    selection = store.currentArrivals.filter((x: Arrival) => x._pick?.evaluation_mode === 'manual')
  } else if (value === 'automatic') {
    selection = store.currentArrivals.filter((x: Arrival) => x._pick?.evaluation_mode === 'automatic')
  } else if (value === 'p') {
    selection = store.currentArrivals.filter((x: Arrival) => x.phase === 'P')
  }
  store.selectArrivals(selection)
}

onMounted(() => {
  if (store.currentEvent == null || store.currentEvent.public_id !== props.eventid) {
    loading.value = true
    client.getEvents({
      eventid: props.eventid,
      includearrivals: true,
      includeallmagnitudes: true,
      includefocalmechanism: true
      // includestationmagnitudes: true
    }).then((response) => {
      if (response.length > 0) {
        const event = response[0]
        store.setEvent(event)
      }
    }).finally(() => {
      loading.value = false
    })
  }
})

onBeforeRouteLeave((to, from) => {
  if (picker.value) {
    return false
  }
})
</script>

<template>
  <v-app-bar density="compact">
    <v-app-bar-title>
      {{ store.currentEvent?.public_id }}
      <v-chip
        label
        variant="outlined"
        size="x-small"
        :color="store.currentEvent?.type == null ? 'grey' : 'green'"
        class="text-uppercase"
      >
        {{ store.currentEvent?.type || 'NO TYPE SET' }}
      </v-chip>
    </v-app-bar-title>
    <v-spacer></v-spacer>
    <v-btn @click="enablePicker" title="picker (Alt + Shift + P)"><v-icon>mdi-pulse</v-icon></v-btn>
    <v-btn title="browse origins"><v-icon>mdi-list-box-outline</v-icon></v-btn>
    <v-divider vertical class="mx-2"></v-divider>
    <RelocateComponent
      :status="store.eventViewStatus.relocateStatus"
      @relocate="relocate"/>
    <ComputeMagnitudeComponent
      v-if="store.currentOrigin != null"
      :status="store.eventViewStatus.computeMagnitudesStatus"
      :origin="store.currentOrigin"
      @compute-magnitudes="(opt: ComputeMagnitudesOptions) => computeMagnitudes(opt)"/>
    <CommitComponent
      :status="store.eventViewStatus.commitStatus"
      @commit="(opt: CommitOptions) => commit(opt)"/>
  </v-app-bar>
  <v-row>
    <v-col cols="10" class="d-flex justify-end align-center">
      SELECTION:
      <v-btn class="ml-2" size="small" @click="select('all')">ALL</v-btn>
      <v-btn class="ml-2" size="small" @click="select('manual')">MANUAL</v-btn>
      <v-btn class="ml-2" size="small" @click="select('automatic')">AUTOMATIC</v-btn>
      <v-btn class="ml-2" size="small" @click="select('p')">P ONLY</v-btn>
    </v-col>
    <v-col cols="2" class="d-flex justify-end align-center">
      CHART:
      <v-btn size="small" class="ml-2" @click="activeChart = 'residual'" :active="activeChart === 'residual'">Res</v-btn>
      <v-btn size="small" class="ml-2" @click="activeChart = 'traveltime'" :active="activeChart === 'traveltime'">TT</v-btn>
    </v-col>
  </v-row>
  <v-row>
    <v-col cols="5">
      <OriginMap/>
    </v-col>
    <v-col cols="7">
      <v-card>
        <v-card-text class="pa-0">
          <ResVsDistChart v-if="activeChart === 'residual'"/>
          <TraveltimeChart v-if="activeChart === 'traveltime'"/>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
  <v-row>
    <v-col cols="8">
      <OriginPanel
        :origin="store.currentOrigin"
        :status="store.eventViewStatus.relocateStatus"/>
    </v-col>
    <v-col cols="4">
      <MagnitudePanel
        :magnitude="store.currentMagnitude"
        :status="store.eventViewStatus.computeMagnitudesStatus"/>
    </v-col>
  </v-row>
  <v-row>
    <v-col cols="12">
      <ArrivalPanel/>
    </v-col>
  </v-row>
  <PickerPanel v-model="picker" v-if="store.currentOrigin != null"/>
  <v-overlay v-model="loading" class="align-center justify-center text-black">
    <v-progress-circular indeterminate color="black"></v-progress-circular>
    Loading...
  </v-overlay>
</template>