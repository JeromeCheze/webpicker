<script setup lang="ts">
import type { Arrival } from '@/lib/sismojs/src/core/event/types'
import FirstMotion from '@/components/FirstMotion.vue'
import { Client } from '@/lib/sismojs/src/fdsn'
import type { CommitOptions } from '@/types'
import { ref, onMounted, watch } from 'vue'
import { useAppStore } from '@/stores/app'

const store = useAppStore()

const props = defineProps({
  eventid: String
})

const client = new Client('..')

const picker = ref(false)
const activeChart = ref('residual' as 'residual' | 'traveltime' | 'firstmotion' | 'magnitude')
const allOriginDisplay = ref(false)

function commit(opt: CommitOptions) {
  if (store.eventViewStatus.commitStatus === 'disabled') {
    return
  }
  alert('commit not implemented')
}

function enablePicker() {
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
    selection = store.currentArrivals.filter((x: Arrival) => x.pickID.referredObject.evaluationMode === 'manual')
  } else if (value === 'automatic') {
    selection = store.currentArrivals.filter((x: Arrival) => x.pickID.referredObject.evaluationMode === 'automatic')
  } else if (value === 'p') {
    selection = store.currentArrivals.filter((x: Arrival) => x.phase === 'P')
  }
  store.selectArrivals(selection)
}

function loadEvent() {
  store.notification.push({ type: 'progress', value: { text: 'Loading event description...', percent: -1 } })
  client.getEvents({
    eventid: props.eventid,
    includearrivals: true,
    includeallorigins: true,
    includeallmagnitudes: true,
    includefocalmechanism: true,
    includestationmagnitudes: true
  }).then((catalog) => {
    if (catalog.length > 0) {
      const event = catalog[0]
      store.setEvent(event)
    } else {
      store.notification.push({ type: 'warning', value: 'Event not found' })
    }
  }).finally(() => {
    store.notification.push({ type: 'progress', value: null })
  })
}

function handleUsers() {
  const eventUsers = store.activityManager.eventUsers(props.eventid!).filter(x => x !== store.author)
  if (eventUsers.length > 0) {
    store.notification.push({ type: 'warning', value: `This event is currently reviewed by some users (${eventUsers.join(', ')})` })
  }
  // } else {
  //   store.notification.push({ type: 'warning', value: null })
  // }
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
  () => store.currentEvent
], handleUsers)

onMounted(() => {
  handleUsers()
  store.activityManager.update('review', props.eventid)
  if (store.currentEvent == null || store.currentEvent.publicID !== props.eventid) {
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
      {{ store.currentEvent?.publicID }}
      <v-chip
        label
        size="x-small"
        :color="store.currentEvent?.type == null ? 'grey' : 'green'"
        class="text-uppercase mx-1"
      >
        {{ store.currentEvent?.type || 'NO TYPE SET' }}
      </v-chip>
      <v-chip
        label
        size="x-small"
        :color="store.currentOrigin?.evaluationStatus == null ? 'grey' : 'blue'"
        class="text-uppercase mx-1"
      >
        {{ store.currentOrigin?.evaluationStatus || 'NO STATUS SET' }}
      </v-chip>
    </v-app-bar-title>
    <v-spacer></v-spacer>
    <v-btn @click="enablePicker" :title="`picker (${store.settings['keybinding.togglePicker']})`"><v-icon>mdi-pulse</v-icon></v-btn>
    <v-btn @click="allOriginDisplay = !allOriginDisplay" title="Inspect event" :active="allOriginDisplay" :disabled="store.currentEvent != null && store.currentEvent.origin.length === 0"><v-icon>mdi-list-box-outline</v-icon></v-btn>
    <v-divider vertical class="mx-2"></v-divider>
    <RelocateComponent/>
    <ComputeMagnitudesComponent v-if="store.currentOrigin != null"/>
    <CommitComponent @update="loadEvent"/>
  </v-app-bar>
  <EventInspector v-if="allOriginDisplay && !picker"/>
  <template v-if="!allOriginDisplay && !picker">
    <v-row>
      <v-col cols="9" class="d-flex justify-end align-center">
        SELECTION:
        <v-btn class="ml-2" size="small" @click="select('all')">ALL</v-btn>
        <v-btn class="ml-2" size="small" @click="select('manual')">MANUAL</v-btn>
        <v-btn class="ml-2" size="small" @click="select('automatic')">AUTOMATIC</v-btn>
        <v-btn class="mx-2" size="small" @click="select('p')">P ONLY</v-btn>
      </v-col>
      <v-col cols="3" class="d-flex justify-end align-center">
        CHART:
        <v-btn size="small" class="ml-2" @click="activeChart = 'residual'">Res</v-btn>
        <v-btn size="small" class="ml-2" @click="activeChart = 'traveltime'">TT</v-btn>
        <v-btn size="small" class="ml-2" @click="activeChart = 'magnitude'">M</v-btn>
        <v-btn size="small" class="ml-2" @click="activeChart = 'firstmotion'">FM</v-btn>
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
            <StationMagnitudeChart v-if="activeChart === 'magnitude'"/>
            <FirstMotion v-if="activeChart === 'firstmotion'"/>
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
  </template>
  <PickerPanel v-model="picker" v-if="picker && store.currentOrigin != null"/>
</template>