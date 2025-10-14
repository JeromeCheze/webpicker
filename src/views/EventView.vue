<script setup lang="ts">
import ComputeMagnitudesComponent from '@/components/ComputeMagnitudesComponent.vue'
import type { QArrival, QMagnitude } from '@/lib/sismojs/src/core/event/types'
import ActionScriptsComponent from '@/components/ActionScriptsComponent.vue'
import StationMagnitudeChart from '@/components/StationMagnitudeChart.vue'
import RelocateComponent from '@/components/RelocateComponent.vue'
import CommitComponent from '@/components/CommitComponent.vue'
import TraveltimeChart from '@/components/TraveltimeChart.vue'
import EventInspector from '@/components/EventInspector.vue'
import ResVsDistChart from '@/components/ResVsDistChart.vue'
import MagnitudePanel from '@/components/MagnitudePanel.vue'
import ArrivalPanel from '@/components/ArrivalPanel.vue'
import FirstMotion from '@/components/FirstMotion.vue'
import OriginPanel from '@/components/OriginPanel.vue'
import PickerPanel from '@/components/PickerPanel.vue'
import OriginMap from '@/components/OriginMap.vue'
import { ref, onMounted, watch } from 'vue'
import { useAppStore } from '@/stores/app'

const store = useAppStore()

const props = defineProps({
  eventid: String
})

const picker = ref(false)
const activeChart = ref('residual' as 'residual' | 'traveltime' | 'firstmotion' | 'magnitude')
const allOriginDisplay = ref(false)

const contextMenu = ref(false)
const contextMenuPos = ref([0, 0] as [number, number])

function enablePicker() {
  picker.value = true
}

function select(value: string) {
  const currentArrivals = store.eventManager.current.arrivals
  if (currentArrivals == null) {
    return
  }
  let selection: QArrival[] = []
  if (value === 'all') {
    selection = currentArrivals
  } else if (value === 'manual') {
    selection = currentArrivals.filter((x: QArrival) => x.pickID.referredObject.evaluationMode === 'manual')
  } else if (value === 'automatic') {
    selection = currentArrivals.filter((x: QArrival) => x.pickID.referredObject.evaluationMode === 'automatic')
  } else if (value === 'p') {
    selection = currentArrivals.filter((x: QArrival) => x.phase === 'P')
  }
  store.eventManager.selectArrivals(selection)
}

function removeUnselectedArrivals() {
  if (store.eventManager.current.origin == null) {
    return
  }
  const toRemove = store.eventManager.current.origin.arrival.filter((x: QArrival) => x.timeWeight != null && x.timeWeight === 0)
  for (const arrival of toRemove) {
    store.eventManager.deleteArrival(arrival.pickID.referredObject)
  }
}

function removeAutomaticArrivals() {
  if (store.eventManager.current.origin == null) {
    return
  }
  const toRemove = store.eventManager.current.origin.arrival.filter((x: QArrival) => x.pickID.referredObject.evaluationMode === 'automatic')
  for (const arrival of toRemove) {
    store.eventManager.deleteArrival(arrival.pickID.referredObject)
  }
}

function setUsedAutomaticPicksStatusAsReviewed() {
  if (store.eventManager.current.origin == null) {
    return
  }
  for (const arrival of store.eventManager.current.origin.arrival) {
    const pick = arrival.pickID.referredObject
    if (pick.evaluationMode === 'automatic' && arrival.timeWeight != null && arrival.timeWeight > 0) {
      pick.evaluationStatus = 'reviewed'
    }
  }
  store.eventManager.current.arrivals = store.eventManager.current.arrivals.map(x => x)
}

function unsetPickStatus() {
  if (store.eventManager.current.origin == null) {
    return
  }
  for (const arrival of store.eventManager.current.origin.arrival) {
    const pick = arrival.pickID.referredObject
    if (arrival.timeWeight != null && arrival.timeWeight > 0) {
      pick.evaluationStatus = undefined
    }
  }
  store.eventManager.current.arrivals = store.eventManager.current.arrivals.map(x => x)
}

function loadEvent() {
  store.notification.push({ type: 'progress', value: { text: 'Loading event description...', percent: -1 } })
  store.eventManager.loadEvent('..', props.eventid!).catch(msg => {
    store.notification.push({ type: 'warning', value: msg })
  }).finally(() => {
    store.notification.push({ type: 'progress', value: null })
  })
}

function handleUsers() {
  const eventUsers = store.webSocketManager.eventUsers(props.eventid!).filter(x => x !== store.author)
  if (eventUsers.length > 0) {
    store.notification.push({ type: 'warning', value: `This event is currently reviewed by some users (${eventUsers.join(', ')})` })
  }
  // } else {
  //   store.notification.push({ type: 'warning', value: null })
  // }
}

function handleContextMenu(e: MouseEvent) {
  e.preventDefault()
  console.log('contextmenu')
  contextMenuPos.value = [e.clientX, e.clientY]
  contextMenu.value = true
}

function setCurrentMagnitude(m: QMagnitude) {
  store.eventManager.current.magnitude = m
  store.eventManager.status.commit = 'required'
}

watch(() => store.keydown, (newValue) => {
  if (newValue === store.settings['keybinding.togglePicker']) {
    if (picker.value) {
      picker.value = false
    } else {
      enablePicker()
    }
  }
})

watch([
  () => store.usersActivity,
  () => store.eventManager.current.event
], handleUsers)

onMounted(() => {
  console.log(`[EventView.onMounted] ${props.eventid}`)
  handleUsers()
  store.webSocketManager.update('review', props.eventid)
  if (store.eventManager.current.event == null || store.eventManager.current.event.publicID !== props.eventid) {
    loadEvent()
  }
})

// onBeforeRouteLeave((to, from) => {
//   if (picker.value) {
//     return false
//   }
// })
</script>

<template>
  <v-app-bar density="compact" v-if="!picker">
    <v-app-bar-title>
      {{ store.eventManager.current.event?.publicID }}
      <v-chip
        label
        size="x-small"
        :color="store.eventManager.current.event?.type == null ? 'grey' : 'green'"
        class="text-uppercase mx-1"
      >
        {{ store.eventManager.current.event?.type || 'NO TYPE SET' }}
      </v-chip>
      <v-chip
        label
        size="x-small"
        :color="store.eventManager.current.origin?.evaluationStatus == null ? 'grey' : 'blue'"
        class="text-uppercase mx-1"
      >
        {{ store.eventManager.current.origin?.evaluationStatus || 'NO STATUS SET' }}
      </v-chip>
    </v-app-bar-title>
    <v-spacer></v-spacer>
    <v-btn @click="enablePicker" :title="`picker (${store.settings['keybinding.togglePicker']})`"><v-icon>mdi-pulse</v-icon></v-btn>
    <v-btn @click="allOriginDisplay = !allOriginDisplay" title="Inspect event" :active="allOriginDisplay" :disabled="store.eventManager.current.event != null && store.eventManager.current.event.origin.length === 0"><v-icon>mdi-list-box-outline</v-icon></v-btn>
    <v-divider vertical class="mx-2"></v-divider>
    <ActionScriptsComponent/>
    <v-divider vertical class="mx-2"></v-divider>
    <RelocateComponent/>
    <ComputeMagnitudesComponent v-if="store.eventManager.current.origin != null"/>
    <CommitComponent @update="loadEvent"/>
  </v-app-bar>
  <EventInspector v-if="allOriginDisplay && !picker"/>
  <template v-if="!allOriginDisplay && !picker">
    <v-row>
      <v-col cols="12" class="d-flex justify-end align-center">
        <v-btn-group density="compact">
          <v-btn :active="activeChart === 'residual'" @click="activeChart = 'residual'">Res</v-btn>
          <v-btn :active="activeChart === 'traveltime'" @click="activeChart = 'traveltime'">TT</v-btn>
          <v-btn :active="activeChart === 'magnitude'" @click="activeChart = 'magnitude'">M</v-btn>
          <v-btn :active="activeChart === 'firstmotion'" @click="activeChart = 'firstmotion'">FM</v-btn>
        </v-btn-group>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="5">
        <OriginMap/>
      </v-col>
      <v-col cols="7">
        <v-card>
          <v-card-text class="pa-0">
            <ResVsDistChart v-if="activeChart === 'residual'" @contextmenu="handleContextMenu"/>
            <TraveltimeChart v-if="activeChart === 'traveltime'" @contextmenu="handleContextMenu"/>
            <StationMagnitudeChart v-if="activeChart === 'magnitude'"/>
            <FirstMotion v-if="activeChart === 'firstmotion'"/>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="8">
        <OriginPanel
          :origin="store.eventManager.current.origin"
          :status="store.eventManager.status.relocate"/>
      </v-col>
      <v-col cols="4">
        <v-row>
          <v-col cols="12"  class="d-flex justify-end align-center">
            <v-btn-group density="compact">
              <v-btn
                v-for="magnitude in store.eventManager.current.originMagnitudes"
                class="text-none"
                :active="magnitude.publicID === store.eventManager.current.magnitude?.publicID"
                @click="setCurrentMagnitude(magnitude)"
              >{{ magnitude.type }}</v-btn>
            </v-btn-group>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <MagnitudePanel
              :magnitude="store.eventManager.current.magnitude"
              :status="store.eventManager.status.computeMagnitudes"/>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <ArrivalPanel/>
      </v-col>
    </v-row>
  </template>
  <PickerPanel
    v-model="picker" v-if="picker && store.eventManager.current.origin != null"
    :time-window="[store.settings['miscellaneous.timewindow1'], store.settings['miscellaneous.timewindow2']]"
    :time="store.eventManager.current.origin.time.object.getTime()"
    :latitude="store.eventManager.current.origin.latitude.value"
    :longitude="store.eventManager.current.origin.longitude.value"
    :depth="store.eventManager.current.origin.depth.value"
    :seedid-list="[]"
    :no-event="false"
    base-url=".."/>
  <v-menu
    v-model="contextMenu"
    attach
    :target="contextMenuPos"
    z-index="4000"
    :style="{ position: 'absolute', top: `${contextMenuPos[1]}px`, left: `${contextMenuPos[0]}px` }"
    :transition="false"
  >
    <v-card>
      <v-list density="compact">
        <v-list-subheader>Selection</v-list-subheader>
        <v-list-item class="pl-10" @click="select('all')">all</v-list-item>
        <v-list-item class="pl-10" @click="select('manual')">manual</v-list-item>
        <v-list-item class="pl-10" @click="select('automatic')">automatic</v-list-item>
        <v-list-item class="pl-10" @click="select('p')">P only</v-list-item>
        <v-list-subheader>Action</v-list-subheader>
        <v-list-item class="pl-10" @click="removeUnselectedArrivals">remove unselected</v-list-item>
        <v-list-item class="pl-10" @click="removeAutomaticArrivals">remove automatic</v-list-item>
        <v-list-item class="pl-10" @click="setUsedAutomaticPicksStatusAsReviewed">set selected automatic picks status as 'reviewed'</v-list-item>
        <v-list-item class="pl-10" @click="unsetPickStatus">unset pick status</v-list-item>
      </v-list>
    </v-card>
  </v-menu>
</template>