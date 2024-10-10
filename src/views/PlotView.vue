<script setup lang="ts">
import { getLocalStorageDefault, setLocalStorage, getId } from '@/utils'
import { QEvent, QOrigin } from '@/lib/sismojs/src/core/event/types'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ref, onMounted, watch } from 'vue'
import { useAppStore } from '@/stores/app'

const STORAGE_KEY = 'plotStationRadius-v3'

const store = useAppStore()
const router = useRouter()
const route = useRoute()

const opt = Object.assign(getLocalStorageDefault('plotOptions', {
  starttime: new Date().toISOString(),
  latitude: 0,
  longitude: 0,
  duration: 300
}), route.query)

console.log(opt)

const form = ref()
const picker = ref(false)
const stationRadius = ref()
const stationRadiusState = ref(false)
const starttime = ref(new Date(opt.starttime))
const duration = ref(parseFloat(opt.duration))
const latitude = ref(parseFloat(opt.latitude))
const longitude = ref(parseFloat(opt.longitude))
const seedidList = ref([] as string[])

function checkDuration(v: number) {
  return v > 0 || 'Value must be > 0'
}

function reset() {
  store.dataManager.clearDetectorCache()
  store.dataManager.clearDistanceAzimuth()
  store.dataManager.clearInventoryCache()
  store.dataManager.clearTTTCache()
  store.dataManager.clearWaveformCache()
  store.currentEvent = null
  store.currentOrigin = null
  store.currentMagnitude = null
  store.currentOriginMagnitudes = []
  store.currentArrivals = []
  store.updatePickMap()
  stationRadiusState.value = true
}

function handleSubmit(seedids: string[]) {
  if (form.value.validate()) {
    setLocalStorage('plotOptions', {
      starttime: starttime.value.toISOString(),
      latitude: latitude.value,
      longitude: longitude.value,
      duration: duration.value
    })
    const originId = getId('Origin')
    const event = new QEvent({
      '@publicID': getId('Event'),
      pick: [],
      amplitude: [],
      origin: [],
      magnitude: [],
      stationMagnitude: [],
      focalMechanism: [],
      preferredOriginID: originId
    })
    const origin = new QOrigin({
      '@publicID': originId,
      time: { value: starttime.value.toISOString() },
      latitude: { value: latitude.value, uncertainty: 1 },
      longitude: { value: longitude.value, uncertainty: 1 },
      evaluationMode: 'manual',
      evaluationStatus: 'preliminary',
      creationInfo: {
        author: store.author!,
        agencyID: 'OCA',
        creationTime: new Date().toISOString()
      },
      depth: { value: 5 * 1e3 },
      methodID: 'free_placement',
      arrival: []
    }, event.id)
    store.currentEvent = event
    store.currentOrigin = origin
    store.currentArrivals = origin.arrival
    store.updatePickMap()
    seedidList.value = seedids
    const query = Object.assign({
      network: '*',
      station: '*',
      location: '*',
      channel: '?H?',
      latitude: latitude.value,
      longitude: longitude.value,
      radius: store.settings['miscellaneous.defaultRadius'],
      starttime: starttime.value.toISOString(),
      duration: duration.value
    }, getLocalStorageDefault(STORAGE_KEY, {}))
    router.push({ name: 'plot', query})
    stationRadiusState.value = false
    picker.value = true
  }
}

watch(() => picker.value, (value) => {
  if (!value) {
    reset()
  }
})

onMounted(() => {
  reset()
  if (Object.keys(route.query).length > 0) {
    stationRadius.value.ready(() => {
      setTimeout(() => {
        stationRadius.value.validate()
      }, 200)
    })
  }
})

onBeforeRouteLeave(async (to, from) => {
  if (store.currentOrigin != null && store.currentEvent != null && store.currentEvent.pick.length > 0) {
    const minPickTime = Math.min.apply(null, store.currentEvent.pick.map(p => p.time.object.getTime()))
    store.currentOrigin.setTime({ value: new Date(minPickTime).toISOString() })
    if (confirm('Leave picking?')) {
      store.eventViewStatus.relocateStatus = 'enabled'
      store.eventViewStatus.computeMagnitudesStatus = 'disabled'
      store.eventViewStatus.commitStatus = 'enabled'
      return true
    }
    return false
  }
})
</script>

<template>
  <PickerPanel
    v-if="picker"
    v-model="picker"
    :time-window="[0, duration]"
    :time="starttime.getTime()"
    :latitude="latitude"
    :longitude="longitude"
    :depth="5"
    :seedid-list="seedidList"
    base-url="."
    no-event/>
  <v-card max-width="500" :style="{ marginLeft: 'auto', marginRight: 'auto' }" v-else>
    <v-card-title>
      <div class="text-h5 text-medium-emphasis ps-2 py-2">Plot waveforms</div>
    </v-card-title>
    <v-card-text>
      <v-form ref="form">
        <v-row>
          <v-col cols="6">
            <DateField label="Starttime" density="compact" v-model="starttime" time/>
          </v-col>
          <v-col cols="6">
            <NumberField density="compact" label="Duration [s]" v-model="duration" :rules="[checkDuration]"/>
          </v-col>
        </v-row>
      </v-form>
      <v-row>
        <v-col cols="12">
          <StationRadius
            ref="stationRadius"
            :time="starttime.getTime()"
            v-model="stationRadiusState"
            v-model:latitude="latitude"
            v-model:longitude="longitude"
            base-url="."
            :storage-key="STORAGE_KEY"
            :use-saved-lat-lon="false"
            @radius-stations="handleSubmit"/>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>