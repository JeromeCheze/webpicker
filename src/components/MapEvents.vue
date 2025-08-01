<script setup lang="ts">
import * as L from 'leaflet'
import { QEvent } from '@/lib/sismojs/src/core/event/types'
import { ref, onMounted, watch, computed } from 'vue'
import MagnitudePanel from './MagnitudePanel.vue'
import { DISCARDED_EVENT_TYPES } from '@/utils'
import OriginPanel from './OriginPanel.vue'
import { useAppStore } from '@/stores/app'

const AUTOMATIC_ORIGIN = 'red'
const MANUAL_ORIGIN = 'green'
const PRELIMINARY_ORIGIN = 'orange'
const DISCARDED = 'grey'
const NO_MAGNITUDE = 'blue'
const EARTHQUAKE = 'green'
const EXPLOSION = 'yellow'
const OTHER = 'purple'

const store = useAppStore()

const props = defineProps<{
  height: number
  hideDiscarded: boolean
}>()

const mapContainer = ref()
const legend = ref()
const map = ref(null as L.Map | null)
const layers = {} as { [eventid: string]: L.CircleMarker }
const activeEvent = ref(undefined as QEvent | undefined)
const sizeBy = ref('magnitude')

const filteredEventList = computed(() => {
  if (props.hideDiscarded === true) {
    return store.events.filter((e) => {
      const eventType = e.type || ''
      const poStatus = e.preferredOriginID.referredObject.evaluationStatus || ''
      if (DISCARDED_EVENT_TYPES.indexOf(eventType) >= 0 || poStatus === 'rejected') {
        return false
      }
      return true
    })
  }
  return store.events
})

function getRadius(event: QEvent) {
  if (sizeBy.value === 'magnitude') {
    return event.preferredMagnitudeID.id != null ? 3 + event.preferredMagnitudeID.referredObject.mag.value * 2 : 5
  } else {
    const usedPhaseCount = event.preferredOriginID.referredObject.quality?.usedPhaseCount
    if (usedPhaseCount != null) {
      return 2 + usedPhaseCount * 0.25
    }
  }
  return 2
}

function focusEvent(eventid: string | null) {
  if (activeEvent.value != null && activeEvent.value.publicID === eventid) {
    eventid = null
  }
  if (eventid != null) {
    activeEvent.value = store.events.find(x => x.publicID === eventid)
    const marker = layers[eventid]
    map.value!.setView(marker.getLatLng(), 9)
    marker.openPopup()
  } else {
    activeEvent.value = undefined
    const bounds: L.LatLngBoundsExpression = []
    for (const layer of Object.values(layers)) {
      const pos = layer.getLatLng()
      bounds.push([pos.lat, pos.lng])
    }
    if (bounds.length > 1) {
      map.value!.fitBounds(bounds)
    } else {
      map.value!.setView(bounds[0], 9)
    }
  }
}

function getEventMarker(pos: L.LatLngTuple, event: QEvent) {
  const marker = L.circleMarker(pos, {
    weight: 2,
    radius: getRadius(event),
    color: event.preferredOriginID.referredObject.evaluationStatus === 'preliminary'
      ? PRELIMINARY_ORIGIN
      :event.type === 'not reported' || event.type === 'not existing'
        ? DISCARDED
        : event.preferredOriginID.referredObject.evaluationMode === 'manual'
          ? MANUAL_ORIGIN
          : AUTOMATIC_ORIGIN,
    fillColor: event.type === 'not reported' || event.type === 'not existing' || event.preferredOriginID.referredObject.evaluationStatus === 'rejected'
      ? DISCARDED
      : event.preferredMagnitudeID.id == null
        ? NO_MAGNITUDE
        : event.type === 'earthquake'
          ? EARTHQUAKE
          : event.type === 'quarry blast' || event.type === 'explosion'
            ? EXPLOSION
            : OTHER,
    fillOpacity: event.type == null ? 0 : 0.4
  }).addTo(map.value as L.Map)
  marker.bindPopup(event.publicID)
  marker.on('click', () => {
    focusEvent(event.publicID)
  })
  return marker
}

function drawEvents() {
  if (map.value == null) {
    return
  }
  map.value.closePopup()
  for (const [key, layer] of Object.entries(layers)) {
    layer.remove()
    delete layers[key]
  }
  const bounds: L.LatLngTuple[] = []
  for (const event of filteredEventList.value) {
    if (event.preferredOriginID.id == null) {
      continue
    }
    const pos: L.LatLngTuple = [event.preferredOriginID.referredObject.latitude.value, event.preferredOriginID.referredObject.longitude.value]
    const worldCenter = store.settings['miscellaneous.longitudeReference']
    if (worldCenter > 0 && worldCenter - 180 > pos[1]) {
      pos[1] += 360
    } else if (worldCenter < 0 && worldCenter + 180 < pos[1]) {
      pos[1] -= 360
    }
    bounds.push(pos)
    const marker = getEventMarker(pos, event)
    layers[event.publicID] = marker
  }
  map.value.fitBounds(bounds)
}

function initMap() {
  if (mapContainer.value == null) {
    return
  }
  const container = mapContainer.value
  map.value = L.map(container, { trackResize: false, attributionControl: false, worldCopyJump: false, zoomControl: false, zoomAnimation: false })
  map.value.on('click', () => {
    focusEvent(null)
  })
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
  L.control.zoom({ position: 'topright' }).addTo(map.value as L.Map)
  L.control.scale({ imperial: false }).addTo(map.value as L.Map)
  const LegendControl = L.Control.extend({ onAdd: () => legend.value })
  new LegendControl({ position: 'topleft' }).addTo(map.value as L.Map)
  plan.addTo(map.value as L.Map)
  drawEvents()
}

watch(() => activeEvent.value, () => {
  setTimeout(() => {
    map.value!.invalidateSize()
  }, 500)
})

watch(() => sizeBy.value, () => {
  drawEvents()
})

watch(() => filteredEventList.value, drawEvents)

onMounted(() => {
  initMap()
  if (store.eventManager.current.event != null) {
    focusEvent(store.eventManager.current.event.publicID)
  }
})
</script>

<template>
  <v-card>
    <v-card-text v-if="store.events.length === 0">
      No events to display<br>
      Go to <router-link :to="{ name: 'form' }">form</router-link> to define query parameters
    </v-card-text>
    <v-card-text class="pa-0" v-else>
      <div class="d-flex flex-row justify-start align-center">
        <div class="px-2">Size by:</div>
        <v-radio-group inline v-model="sizeBy" hide-details>
          <v-radio label="magnitude" value="magnitude"></v-radio>
          <v-radio label="used phase count" value="usedPhaseCount"></v-radio>
        </v-radio-group>
      </div>
      <div ref="mapContainer" :style="{ height: `${props.height}px` }"></div>
    </v-card-text>
  </v-card>
  <v-navigation-drawer location="right" permanent v-if="activeEvent" width="400">
    <v-card>
      <v-card-title>
        <v-btn variant="text" color="primary" :to="{ name: 'event', params: { eventid: activeEvent.publicID } }">
          {{ activeEvent.publicID }}
        </v-btn>
        <v-chip
          label
          size="x-small"
          :color="activeEvent.type == null ? 'grey' : 'green'"
          class="text-uppercase"
        >
          {{ activeEvent.type || 'NO TYPE SET' }}
        </v-chip>
      </v-card-title>
    </v-card>
    <OriginPanel :origin="activeEvent.preferredOriginID.referredObject" :action-required="false" compact/>
    <MagnitudePanel :magnitude="activeEvent.preferredMagnitudeID.referredObject" :action-required="false" compact/>
  </v-navigation-drawer>
  <div ref="legend">
    <v-card>
      <v-card-text>
        <v-table density="compact">
          <tbody>
            <tr>
              <th colspan="2">Outer color</th>
            </tr>
            <tr>
              <td>
                <svg width="20" height="20">
                  <circle cx="10" cy="10" r="9" stroke-width="2" :stroke="AUTOMATIC_ORIGIN" fill-opacity="0" />
                </svg>
              </td>
              <td>
                automatic
              </td>
            </tr>
            <tr>
              <td>
                <svg width="20" height="20">
                  <circle cx="10" cy="10" r="9" stroke-width="2" :stroke="MANUAL_ORIGIN" fill-opacity="0" />
                </svg>
              </td>
              <td>
                manual
              </td>
            </tr>
            <tr>
              <td>
                <svg width="20" height="20">
                  <circle cx="10" cy="10" r="9" stroke-width="2" :stroke="PRELIMINARY_ORIGIN" fill-opacity="0" />
                </svg>
              </td>
              <td>
                preliminary
              </td>
            </tr>
            <tr>
              <td>
                <svg width="20" height="20">
                  <circle cx="10" cy="10" r="9" stroke-width="2" :stroke="DISCARDED" fill-opacity="0" />
                </svg>
              </td>
              <td>
                discarded
              </td>
            </tr>
            <tr>
              <th colspan="2">Inner color</th>
            </tr>
            <tr>
              <td>
                <svg width="20" height="20">
                  <circle cx="10" cy="10" r="9" stroke-width="2" :fill="EARTHQUAKE" fill-opacity="1" stroke-opacity="0" />
                </svg>
              </td>
              <td>
                earthquake
              </td>
            </tr>
            <tr>
              <td>
                <svg width="20" height="20">
                  <circle cx="10" cy="10" r="9" stroke-width="2" :fill="EXPLOSION" fill-opacity="1" stroke-opacity="0" />
                </svg>
              </td>
              <td>
                explosion
              </td>
            </tr>
            <tr>
              <td>
                <svg width="20" height="20">
                  <circle cx="10" cy="10" r="9" stroke-width="2" :fill="NO_MAGNITUDE" fill-opacity="1" stroke-opacity="0" />
                </svg>
              </td>
              <td>
                no magnitude
              </td>
            </tr>
            <tr>
              <td>
                <svg width="20" height="20">
                  <circle cx="10" cy="10" r="9" stroke-width="2" :fill="DISCARDED" fill-opacity="1" stroke-opacity="0" />
                </svg>
              </td>
              <td>
                discarded
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>
  </div>
</template>