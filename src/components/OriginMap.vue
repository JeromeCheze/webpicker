<script setup lang="ts">
import type { ColorScaleOptions } from '@/lib/lichen/src/types'
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import type { WPNotificationOptions } from '@/types'
import DataUtils from '@/lib/lichen/src/dataUtils'
import { useAppStore } from '@/stores/app'
import * as L from 'leaflet'
import 'leaflet-ellipse'

const store = useAppStore()

const emit = defineEmits(['stationClick'])

const props = defineProps<{
  focusStation?: string | null
  height?: string,
  stationList?: string[]
}>()

const mapContainer = ref()
const map = ref(null as L.Map | null)
const layers = [] as L.Layer[]
let netstaMapMarker: Record<string, L.CircleMarker> = {}
let debounceResize: number | null = null
const resizeObserver = new ResizeObserver(() => {
  if (debounceResize != null) {
    window.clearTimeout(debounceResize)
  }
  debounceResize = window.setTimeout(() => {
    if (map.value != null) {
      map.value.invalidateSize()
    }
  }, 500)
})

const originLatLng = computed(() => {
  if (store.eventManager.current.origin != null) {
    return L.latLng([store.eventManager.current.origin.latitude.value, store.eventManager.current.origin.longitude.value])
  }
})

const originUncertainty = computed(() => {
  if (store.eventManager.current.origin != null) {
    const latUncertainty = store.eventManager.current.origin.latitude.uncertainty
    const lonUncertainty = store.eventManager.current.origin.longitude.uncertainty
    if (latUncertainty != null && lonUncertainty != null) {
      return [lonUncertainty * 1e3, latUncertainty * 1e3]
    }
  }
  return null
})

function initMap() {
  if (mapContainer.value != null && map.value == null) {
    const container = mapContainer.value
    map.value = L.map(container, { trackResize: false, attributionControl: false, zoomAnimation: false })
    const plan = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}')
    const worldtopomap = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}')
    const satmap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
    const baseLayers = { Plan: plan, Terrain: worldtopomap, Satellite: satmap }
    L.control.layers(baseLayers).addTo(map.value as L.Map)
    L.control.scale({ imperial: false }).addTo(map.value as L.Map)
    plan.addTo(map.value as L.Map)
    map.value.setView([0, 0], 5)
    resizeObserver.observe(container)
  }
}

function displayOrigin() {
  if (map.value == null || originLatLng.value == null) {
    return
  }
  if (originUncertainty.value != null) {
    const ellipse = L.ellipse(originLatLng.value, originUncertainty.value, 0, {
      weight: 0,
      color: 'red',
      fillOpacity: 0.2
    }).addTo(map.value as L.Map)
    layers.push(ellipse)
  }
  const originMarker = L.circleMarker(originLatLng.value, { color: 'red', radius: 5, fillOpacity: 1 }).addTo(map.value as L.Map)
  layers.push(originMarker)
  // map.value.setView(originLatLng.value, 8)
}

function handleNotification(opt: WPNotificationOptions) {
  store.notification.push(opt)
}

function displayStations() {
  if (store.eventManager.current.origin == null || store.eventManager.current.arrivals == null) {
    return
  }
  store.dataManager.getOriginStationInventory(
    '..',
    store.eventManager.current.origin.time.object.getTime(),
    store.eventManager.current.origin.latitude.value,
    store.eventManager.current.origin.longitude.value,
    store.eventManager.current.arrivals,
    handleNotification
  ).then((inv) => {
    if (store.eventManager.current.origin == null || store.eventManager.current.arrivals == null || map.value == null) {
      return
    }
    const oPos = [store.eventManager.current.origin.latitude.value, store.eventManager.current.origin.longitude.value] as L.LatLngTuple
    const bounds: L.LatLngTuple[] = [oPos]
    const stationMap: Record<string, number | null> = {}
    let maxRes = 0
    for (const arrival of store.eventManager.current.arrivals) {
      if (arrival.timeWeight != null) {
        const netsta = arrival.pickID.referredObject.waveformID.netsta
        const v = stationMap[netsta]
        if (arrival.timeWeight > 0) {
          if (arrival.timeResidual != null) {
            maxRes = Math.max(maxRes, Math.abs(arrival.timeResidual))
            stationMap[netsta] = v != null
              ? Math.abs(v) > Math.abs(arrival.timeResidual)
                ? v
                : arrival.timeResidual
              : arrival.timeResidual
          } else {
            stationMap[netsta] = v != null ? v : 0
          }
        } else {
          stationMap[netsta] = v != null ? v : null
        }
      }
    }
    if (maxRes === 0) {
      maxRes = 1
    }
    const colorScale: ColorScaleOptions = {
      stops: [
        [0, [0, 0, 255]],
        [0.5, [255, 255, 255]],
        [1, [255, 0, 0]]
      ],
      min: -1 * maxRes,
      max: maxRes,
      logarithmic: false,
      category: false
    }
    const oLon = store.eventManager.current.origin.longitude.value
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
      const staPos = [pos.lat, pos.lon] as L.LatLngTuple
      bounds.push(staPos)
      const color = residual == null ? 'grey' : DataUtils.getColor(residual, colorScale) as string
      const marker = L.circleMarker(staPos, { radius: 4, color: 'grey', fillOpacity: 1, fillColor: color, weight: 1 })
        .on('click', () => emit('stationClick', netsta))
        .bindPopup(netsta)
        .addTo(map.value as L.Map)
      layers.push(marker)
      netstaMapMarker[netsta] = marker
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

function displayStationAlt() {
  if (props.stationList != null && store.eventManager.current.origin != null && map.value != null) {
    const oLat = store.eventManager.current.origin.latitude.value
    const oLon = store.eventManager.current.origin.longitude.value
    const bounds: L.LatLngTuple[] = [[oLat, oLon]]
    for (const netsta of props.stationList) {
      const pos = store.dataManager.getStationPos(netsta)
      if (pos != null) {
        if (oLon > 90 && pos.lon < 0) {
          pos.lon += 360
        } else if (oLon < -90 && pos.lon > 0) {
          pos.lon -= 360
        }
        bounds.push([pos.lat, pos.lon])
        const marker = L.circleMarker([pos.lat, pos.lon], { radius: 4, color: 'grey', fillOpacity: 1, fillColor: 'white', weight: 1 })
          .on('click', () => {
            emit('stationClick', netsta)
          })
          .bindPopup(netsta)
          .addTo(map.value as L.Map)
        layers.push(marker)
        netstaMapMarker[netsta] = marker
        const line = L.polyline([[oLat, oLon], [pos.lat, pos.lon]], { color: 'grey', weight: 1 }).addTo(map.value as L.Map)
        layers.push(line)
        line.bringToBack()
      }
    }
    if (bounds.length > 1) {
      map.value.fitBounds(bounds, { animate: false })
    } else {
      map.value.setView(bounds[0], 8)
    }
  }
}

function reset() {
  for (const layer of layers) {
    layer.remove()
  }
  layers.splice(0, layers.length)
  netstaMapMarker = {}
}

function update() {
  initMap()
  reset()
  if (store.eventManager.current.origin != null) {
    displayOrigin()
    if (props.stationList != null) {
      displayStationAlt()
    } else {
      displayStations()
    }
    if (props.focusStation != null) {
      focusStation(props.focusStation)
    }
  }
}

function focusStation(netsta: string | null | undefined) {
  if (netsta != null && netstaMapMarker[netsta] != null) {
    netstaMapMarker[netsta].openPopup()
  } else {
    if (map.value != null) {
      map.value.closePopup()
    }
  }
}

// watch(() => store.eventManager.current.origin, () => {
//   update()
// })

watch([
  () => store.eventManager.current.arrivals,
  () => props.stationList
], () => {
  update()
})

watch(() => props.focusStation, () => {
  focusStation(props.focusStation)
})

onMounted(() => {
  update()
})
onBeforeUnmount(() => {
  resizeObserver.disconnect()
})
</script>

<template>
  <v-card :style="{ height: '100%' }">
    <v-card-text class="pa-0" :style="{ height: '100%' }">
      <div ref="mapContainer" :style="{ minHeight: '300px', height: props.height }"></div>
    </v-card-text>
  </v-card>
</template>