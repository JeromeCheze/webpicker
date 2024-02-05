<script setup lang="ts">
import type { ColorScaleOptions } from '@/lib/lichen/src/types'
import type { Inventory } from '@/lib/sismojs/src/types'
import DataUtils from '@/lib/lichen/src/dataUtils'
import L, { type LatLngTuple } from 'leaflet'
import { ref, computed, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import 'leaflet-ellipse'

const store = useAppStore()

const mapContainer = ref()
const map = ref(null as L.Map | null)
const layers = [] as L.Layer[]
const inventory = ref({} as Inventory)

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
  const plan = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Sources: Esri, HERE, DeLorme, USGS, Intermap, increment P Corp., NRCAN, Esri Japan, METI, Esri China (Hong Kong), <br>Esri (Thailand), TomTom, MapmyIndia, &copy; OpenStreetMap contributors, and the GIS User Community',
  })
  const worldtopomap = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri, HERE, DeLorme, TomTom, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, <br>Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), swisstopo, MapmyIndia, © OpenStreetMap contributors, and the GIS User Community'
  })
  const satmap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, <br>USGS, AEX, Getmapping, Aerogrid, IGN, IGP, swisstopo, and the GIS User Community'
  })
  const baseLayers = {
    Plan: plan,
    Terrain: worldtopomap,
    Satellite: satmap
  }
  L.control.layers(baseLayers).addTo(map.value as L.Map)
  L.control.scale({ imperial: false }).addTo(map.value as L.Map)
  plan.addTo(map.value as L.Map)
}

function getStationPos(net: string, sta: string) {
  if (inventory.value[net] != null) {
    if (inventory.value[net][sta] != null) {
      return [inventory.value[net][sta].lat, inventory.value[net][sta].lon]
    }
  }
  return null
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
  map.value.setView(originLatLng.value, 8)
}

function displayStation() {
  if (store.currentOrigin == null || store.currentArrivals == null) {
    return
  }
  store.dataManager.getOriginStationInventory('..', store.currentOrigin).then((inv) => {
    inventory.value = inv as Inventory
    if (store.currentOrigin == null || store.currentArrivals == null || map.value == null || inventory.value == null) {
      return
    }
    const evPos = [store.currentOrigin.latitude.value, store.currentOrigin.longitude.value] as LatLngTuple
    const bounds: LatLngTuple[] = [evPos] 
    let maxRes = 0
    for (const arrival of store.currentArrivals) {
      if (arrival.time_weight > 0) {
        maxRes = Math.max(maxRes, Math.abs(arrival.time_residual))
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
    for (const arrival of store.currentArrivals) {
      if (arrival._pick == null || arrival._pick.waveform_id == null) {
        continue
      }
      const wfid = arrival._pick.waveform_id
      const pos = getStationPos(wfid.network_code, wfid.station_code) as LatLngTuple | null
      if (pos == null) {
        console.warn(`failed to get coordinates for channel ${arrival._pick._seedid}`)
        continue
      }
      if (oLon > 0 && pos[1] < 0) {
        pos[1] += 360
      } else if (oLon < 0 && pos[1] > 0) {
        pos[1] -= 360
      }
      bounds.push(pos)
      const color = arrival.time_weight === 0 ? 'grey' : DataUtils.getColor(arrival.time_residual, colorScale) as string
      const marker = L.circleMarker(pos, { radius: 4, color: 'grey', fillOpacity: 1, fillColor: color, weight: 1 }).addTo(map.value as L.Map)
      const tooltip = L.tooltip().setContent(`${wfid.network_code}.${wfid.station_code}`)
      marker.bindTooltip(tooltip)
      layers.push(tooltip)
      layers.push(marker)
      if (arrival.time_weight === 0) {
        marker.bringToBack()
      }
      if (arrival.time_weight > 0) {
        const line = L.polyline([evPos, pos], { color: 'grey', weight: 1 }).addTo(map.value as L.Map)
        layers.push(line)
        line.bringToBack()
      }
    }
    map.value.fitBounds(bounds)
  })
}

function reset() {
  for (const layer of layers) {
    layer.remove()
  }
}

watch(() => store.currentOrigin, () => {
  initMap()
  reset()
  if (store.currentOrigin != null) {
    displayOrigin()
    displayStation()
  }
}, { immediate: true })
</script>

<template>
  <v-card>
    <v-card-text class="pa-0">
      <div ref="mapContainer" :style="{ height: '300px' }"></div>
    </v-card-text>
  </v-card>
</template>