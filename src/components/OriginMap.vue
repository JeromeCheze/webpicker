<script setup lang="ts">
import type { ColorScaleOptions } from '@/lib/lichen/src/types'
import { ref, computed, watch, onMounted } from 'vue'
import type { WPNotificationOptions } from '@/types'
import DataUtils from '@/lib/lichen/src/dataUtils'
import L, { type LatLngTuple } from 'leaflet'
import { useAppStore } from '@/stores/app'
import 'leaflet-ellipse'

const store = useAppStore()

const mapContainer = ref()
const map = ref(null as L.Map | null)
const layers = [] as L.Layer[]

const originLatLng = computed(() => {
  if (store.currentOrigin != null) {
    return L.latLng([store.currentOrigin.latitude.value, store.currentOrigin.longitude.value])
  }
})

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

function displayOrigin() {
  if (map.value == null || originLatLng.value == null) {
    return
  }
  const ellipse = L.ellipse(originLatLng.value, [
    store.currentOrigin!.longitude.uncertainty! * 1e3,
    store.currentOrigin!.latitude.uncertainty! * 1e3
  ], 0, {
    weight: 0,
    color: 'red',
    fillOpacity: 0.2
  }).addTo(map.value as L.Map)
  const originMarker = L.circleMarker(originLatLng.value, { color: 'red', radius: 5, fillOpacity: 1 }).addTo(map.value as L.Map)
  layers.push(ellipse)
  layers.push(originMarker)
  // map.value.setView(originLatLng.value, 8)
}

function handleNotification(opt: WPNotificationOptions) {
  store.notification.push(opt)
}

function displayStations() {
  if (store.currentOrigin == null || store.currentArrivals == null) {
    return
  }
  store.dataManager.getOriginStationInventory('..', store.currentOrigin, store.currentArrivals, handleNotification).then((inv) => {
    if (store.currentOrigin == null || store.currentArrivals == null || map.value == null) {
      return
    }
    const oPos = [store.currentOrigin.latitude.value, store.currentOrigin.longitude.value] as LatLngTuple
    const bounds: LatLngTuple[] = [oPos]
    const stationMap: Record<string, number | null> = {}
    let maxRes = 0
    for (const arrival of store.currentArrivals) {
      if (arrival.timeResidual != null && arrival.timeWeight != null && arrival.timeWeight != null) {
        const netsta = arrival.pickID.referredObject.waveformID.netsta
        const v = stationMap[netsta]
        if (arrival.timeWeight > 0) {
          maxRes = Math.max(maxRes, Math.abs(arrival.timeResidual))
          stationMap[netsta] = v != null
            ? Math.abs(v) > Math.abs(arrival.timeResidual)
              ? v
              : arrival.timeResidual
            : arrival.timeResidual
        } else {
          stationMap[netsta] = v != null ? v : null
        }
      }
    }
    const colorScale: ColorScaleOptions = {
      stops: [
        [0, [0, 0, 255]],
        [0.5, [255, 255, 255]],
        [1, [255, 0, 0]]
      ],
      min: -1 * maxRes,
      max: maxRes,
      logarithmic: false
    }
    const oLon = store.currentOrigin.longitude.value
    for (const [netsta, residual] of Object.entries(stationMap)) {
      const pos = store.dataManager.getStationPos(netsta)
      if (pos == null) {
        console.warn(`failed to get coordinates for channel ${netsta}`)
        continue
      }
      if (oLon > 90 && pos.lon < 0) {
        pos.lon += 360
      } else if (oLon < -90 && pos.lon > 0) {
        pos.lon -= 360
      }
      const staPos = [pos.lat, pos.lon] as LatLngTuple
      bounds.push(staPos)
      const color = residual == null ? 'grey' : DataUtils.getColor(residual, colorScale) as string
      const marker = L.circleMarker(staPos, { radius: 4, color: 'grey', fillOpacity: 1, fillColor: color, weight: 1 })
      .addTo(map.value as L.Map)
      // marker.bindPopup(netsta)
      layers.push(marker)
      if (residual != null) {
        const line = L.polyline([oPos, staPos], { color: 'grey', weight: 1 }).addTo(map.value as L.Map)
        layers.push(line)
        line.bringToBack()
      }
    }
    if (bounds.length > 1) {
      map.value.fitBounds(bounds, { animate: false })
    } else {
      map.value.setView(bounds[0], 8)
    }
  })
}

function reset() {
  for (const layer of layers) {
    layer.remove()
  }
  layers.splice(0, layers.length)
}

function update() {
  initMap()
  reset()
  if (store.currentOrigin != null) {
    displayOrigin()
    displayStations()
  }
}

// watch(() => store.currentOrigin, () => {
//   update()
// })

watch(() => store.currentArrivals, () => {
  update()
})

onMounted(() => {
  update()
})
</script>

<template>
  <v-card>
    <v-card-text class="pa-0">
      <div ref="mapContainer" :style="{ height: '300px' }"></div>
    </v-card-text>
  </v-card>
</template>