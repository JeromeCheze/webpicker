<script setup lang="ts">
import { QEvent, QOrigin } from '@/lib/sismojs/src/core/event/types'
import { useAppStore } from '@/stores/app'
import { deepCopy, getId } from '@/utils'
import { ref, watch } from 'vue'
import router from '@/router'
import * as L from 'leaflet'

const store = useAppStore()

const emit = defineEmits(['update:modelValue'])

const props = defineProps<{
  modelValue: boolean
}>()

const t = store.currentOrigin != null ? store.currentOrigin.time.object : new Date()

const mapContainer = ref()
const map = ref(null as L.Map | null)
const center = ref(null as L.Marker | null)
const dateMenu = ref(false)
const date = ref(t.toISOString().split('T')[0])
const hours = ref(t.getUTCHours())
const minutes = ref(t.getUTCMinutes())
const seconds = ref(t.getUTCSeconds())
const pickerTime = ref(store.currentOrigin != null ? store.currentOrigin.time.object : new Date())
const lat = ref(store.currentOrigin != null ? store.currentOrigin.latitude.value : 43.6113)
const lon = ref(store.currentOrigin != null ? store.currentOrigin.longitude.value : 7.0538)
const depth = ref(5)

function initMap() {
  if (mapContainer.value == null) {
    return
  }
  const container = mapContainer.value
  map.value = L.map(container, { trackResize: false, attributionControl: false })
  const plan = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}')
  const worldtopomap = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}')
  const satmap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
  const baseLayers = { Plan: plan, Terrain: worldtopomap, Satellite: satmap }
  L.control.layers(baseLayers).addTo(map.value as L.Map)
  plan.addTo(map.value as L.Map)
  const pos = [lat.value, lon.value] as L.LatLngTuple
  center.value = L.marker(pos, { icon: L.divIcon({ className: 'circle c-move', iconSize: [10, 10] }), draggable: true }).addTo(map.value as L.Map)
  center.value.on('drag', () => {
    const newPos = center.value!.getLatLng()
    lat.value = newPos.lat
    lon.value = newPos.lng
  })
  map.value.setView(pos, 7)
}

function allowedTime(v: unknown) {
  const value = v as Date
  const now = new Date()
  return value < now
}

function createEvent() {
  const t = new Date(Date.parse(date.value))
  t.setUTCHours(hours.value)
  t.setUTCMinutes(minutes.value)
  t.setUTCSeconds(seconds.value)
  const originID = getId('Origin')
  const origin = new QOrigin({
    '@publicID': originID,
    time: { value: t.toISOString() },
    latitude: { value: lat.value, uncertainty: 1 },
    longitude: { value: lon.value, uncertainty: 1 },
    depth: { value: depth.value * 1e3 },
    arrival: []
  })
  const event = new QEvent({
    '@publicID': getId('Event'),
    pick: [],
    amplitude: [],
    origin: [],
    magnitude: [],
    stationMagnitude: [],
    focalMechanism: [],
    preferredOriginID: originID
  })
  console.log(event)
  store.setEvent(event)
  store.eventViewStatus.relocateStatus = 'enabled'
  store.eventViewStatus.computeMagnitudesStatus = 'disabled'
  store.eventViewStatus.commitStatus = 'disabled'
  emit('update:modelValue', false)
  router.push({ name: 'event', params: { eventid: event.publicID } })
}

watch(pickerTime, (newValue) => {
  const t = new Date(newValue.getTime() - newValue.getTimezoneOffset() * 60e3)
  date.value = t.toISOString().split('T')[0]
  dateMenu.value = false
})

watch([lat, lon], () => {
  if (center.value != null) {
    center.value!.setLatLng([lat.value, lon.value])
  }
})

watch(() => props.modelValue, (value) => {
  if (value === true) {
    setTimeout(() => {
      initMap()
    }, 200)
  }
})

watch(() => store.currentOrigin, () => {
  if (store.currentOrigin != null) {
    const t = store.currentOrigin.time.object
    date.value = t.toISOString().split('T')[0]
    hours.value = t.getUTCHours()
    minutes.value = t.getUTCMinutes()
    seconds.value = t.getUTCSeconds()
    lat.value = store.currentOrigin.latitude.value
    lon.value = store.currentOrigin.longitude.value
    depth.value = store.currentOrigin.depth.value / 1e3
  }
}, { immediate: true })
</script>

<template>
  <v-dialog
    width="600px"
    :model-value="props.modelValue"
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
    attach
  >
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <div class="text-h5 text-medium-emphasis ps-2">Create event</div>
        <v-btn icon="mdi-close" variant="text" @click="emit('update:modelValue', false)"></v-btn>
      </v-card-title>
      <v-card-text :style="{ height: '340px' }">
        <v-row>
          <v-col cols="7">
            <div ref="mapContainer" :style="{ height: '300px' }"></div>
          </v-col>
          <v-col cols="5">
            <div>
              <v-menu offset-y :close-on-content-click="false" v-model="dateMenu">
                <template v-slot:activator="{ props }">
                  <v-text-field density="compact" v-bind="props" v-model="date" label="Date [YYYY-mm-dd]"></v-text-field>
                </template>
                <v-date-picker v-model="pickerTime" :allowed-dates="allowedTime"></v-date-picker>
              </v-menu>
            </div>
            <div class="d-flex justify-space-between align-center">
              <NumberField density="compact" label="hour" v-model="hours"/>
              <span class="px-1">:</span>
              <NumberField density="compact" label="min" v-model="minutes"/>
              <span class="px-1">:</span>
              <NumberField density="compact" label="sec" v-model="seconds"/>
            </div>
            <div><NumberField density="compact" label="Latitude" v-model="lat" suffix="°"/></div>
            <div><NumberField density="compact" label="Longitude" v-model="lon" suffix="°"/></div>
            <div><NumberField density="compact" label="Depth" v-model="depth" suffix="km"/></div>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="createEvent">Validate</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>