<script setup lang="ts">
import type { QOrigin } from '@/lib/sismojs/src/core/event/types'
import type { WPNotificationOptions } from '@/types'
import { ref, watch, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import * as L from 'leaflet'

const store = useAppStore()

const props = defineProps<{
  activeOrigin: QOrigin | null
}>()

const emit = defineEmits(['activeOrigin'])

const mapContainer = ref()
const map = ref(null as L.Map | null)
let layers = [] as L.CircleMarker[]
let stationLayers = [] as L.Layer[]

function handleNotification(opt: WPNotificationOptions) {
  store.notification.push(opt)
}

function initMap() {
  if (mapContainer.value == null || map.value != null) {
    return
  }
  const container = mapContainer.value
  map.value = L.map(container, { trackResize: false, attributionControl: false })
  const plan = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}')
  const worldtopomap = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}')
  const satmap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
  const baseLayers = { Plan: plan, Terrain: worldtopomap, Satellite: satmap }
  L.control.layers(baseLayers).addTo(map.value as L.Map)
  L.control.scale({ imperial: false }).addTo(map.value as L.Map)
  plan.addTo(map.value as L.Map)
  map.value.setView([0, 0], 5)
}

function bindOriginClick(m: L.CircleMarker, origin: QOrigin) {
  m.on('click', () => {
    emit('activeOrigin', origin)
  })
}

function displayOrigins() {
  if (store.eventManager.current.event == null) {
    return
  }
  for (const layer of layers) {
    layer.remove()
  }
  layers = []
  for (const origin of store.eventManager.current.event.origin) {
    const pos = [origin.latitude.value, origin.longitude.value] as L.LatLngTuple
    const m = L.circleMarker(pos, {
      color: 'red',
      weight: 2,
      radius: 5,
      fillOpacity: origin === props.activeOrigin ? 1 : 0
    }).addTo(map.value as L.Map)
    bindOriginClick(m, origin)
    layers.push(m)
  }
}

function displayStations() {
  const bounds: (L.LatLngTuple)[] = []
  for (const m of layers) {
    const pos = m.getLatLng()
    bounds.push([pos.lat, pos.lng])
  }
  if (props.activeOrigin == null) {
    return
  }
  for (const layer of stationLayers) {
    layer.remove()
  }
  stationLayers = []
  const stationMap: Record<string, boolean> = {}
  const oPos = [props.activeOrigin.latitude.value, props.activeOrigin.longitude.value] as L.LatLngTuple
  store.dataManager.getOriginStationInventory(
    '..',
    props.activeOrigin.time.object.getTime(),
    props.activeOrigin.latitude.value,
    props.activeOrigin.longitude.value,
    props.activeOrigin.arrival,
    handleNotification
  ).then((inv) => {
    for (const arrival of props.activeOrigin!.arrival) {
      const netsta = arrival.pickID.referredObject.waveformID.netsta
      if (arrival.timeWeight === 0 || stationMap[netsta] === true) {
        continue
      }
      const pos = store.dataManager.getStationPos(netsta)
      if (pos == null) {
        console.warn(`failed to get coordinates for channel ${netsta}`)
        continue
      }
      const staPos = [pos.lat, pos.lon] as L.LatLngTuple
      bounds.push(staPos)
      const marker = L.circleMarker(staPos, { radius: 4, color: 'grey', fillOpacity: 1, fillColor: 'white', weight: 1 }).addTo(map.value as L.Map)
      stationLayers.push(marker)
      const line = L.polyline([oPos, staPos], { color: 'grey', weight: 1 }).addTo(map.value as L.Map)
      line.bringToBack()
      stationLayers.push(line)
      stationMap[netsta] = true
    }
    map.value!.fitBounds(bounds)
  })
}

watch(() => props.activeOrigin, () => {
  displayOrigins()
  displayStations()
})

onMounted(() => {
  initMap()
  if (store.eventManager.current.event != null) {
    displayOrigins()
  }
})
</script>

<template>
  <v-card>
    <v-card-text class="pa-0">
      <div ref="mapContainer" :style="{ height: '50vh' }"></div>
    </v-card-text>
  </v-card>
</template>