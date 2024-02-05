<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { type EventParameter } from '@/lib/sismojs/src/types/index'
import L, { type LatLngBoundsExpression, type LatLngTuple } from 'leaflet'
import { useAppStore } from '@/stores/app'
import router from '@/router'

const store = useAppStore()

const props = defineProps<{
  events: EventParameter[]
  active?: EventParameter
  height: number
}>()

const mapContainer = ref()
const map = ref(null as L.Map | null)
const layers = {} as { [eventid: string]: L.CircleMarker }
const activeEvent = ref(undefined as EventParameter | undefined)

watch(() => activeEvent.value, () => {
  setTimeout(() => {
    map.value!.invalidateSize()
  }, 500)
})

function getEventMarker(pos: LatLngTuple, event: EventParameter) {
  const marker = L.circleMarker(pos, {
    weight: 1,
    radius: event._pm != null ? 3 + event._pm.mag.value * 2 : 5,
    color: event.type === 'not reported' || event.type === 'not existing'
      ? 'grey'
      : event._po!.evaluation_mode === 'automatic'
        ? 'red'
        : 'green',
    fillColor: event._pm == null
      ? 'blue'
      : event.type === 'earthquake'
        ? 'green'
        : event.type === 'quarry blast' || event.type === 'explosion'
          ? 'yellow'
          : event.type === 'not reported' || event.type === 'not existing'
            ? 'grey'
            : 'purple',
    fillOpacity: event.type == null ? 0 : 0.4
  }).addTo(map.value as L.Map)
  marker.bindPopup(event.public_id)
  marker.on('click', () => {
    focusEvent(event.public_id)
  })
  return marker
}

function initMap() {
  if (mapContainer.value == null) {
    return
  }
  const container = mapContainer.value
  map.value = L.map(container, { trackResize: false, attributionControl: false, worldCopyJump: false })
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
  const bounds: LatLngTuple[] = []
  for (const event of props.events) {
    if (event._po == null) {
      continue
    }
    const pos: LatLngTuple = [event._po.latitude.value, event._po.longitude.value]
    const worldCenter = store.settings.GENERAL.WORLD_CENTER_LONGITUDE
    if (worldCenter > 0 && worldCenter - 180 > pos[1]) {
      pos[1] += 360
    } else if (worldCenter < 0 && worldCenter + 180 < pos[1]) {
      pos[1] -= 360
    }
    bounds.push(pos)
    const marker = getEventMarker(pos, event)
    layers[event.public_id] = marker
  }
  map.value.on('click', () => {
    focusEvent(null)
  })
  map.value.fitBounds(bounds)
}

function focusEvent(eventid: string | null) {
  if (activeEvent.value != null && activeEvent.value.public_id === eventid) {
    eventid = null
  }
  if (eventid != null) {
    activeEvent.value = props.events.find(x => x.public_id === eventid)
  } else {
    activeEvent.value = undefined
  }
  const bounds: LatLngBoundsExpression = []
  for (const [id, marker] of Object.entries(layers)) {
    const pos = marker.getLatLng()
    bounds.push([pos.lat, pos.lng])
    if (eventid == null || id === eventid) {
      map.value!.setView(pos, 9)
      if (eventid != null) {
        marker.openPopup()
      }
    }
  }
  if (eventid == null) {
    map.value!.fitBounds(bounds)
  }
}

function goToEvent() {
  if (activeEvent.value != null) {
    router.push({ name: 'event', params: { eventid: activeEvent.value.public_id } })
  }
}

onMounted(() => {
  initMap()
  if (props.active != null) {
    focusEvent(props.active.public_id)
  }
})
</script>

<template>
  <v-card >
    <v-card-text v-if="props.events.length === 0">
      No events to display<br>
      Go to <router-link :to="{ name: 'form' }">form</router-link> to define query parameters
    </v-card-text>
    <v-card-text class="pa-0" v-else>
      <div ref="mapContainer" :style="{ height: `${props.height}px` }"></div>
    </v-card-text>
  </v-card>
  <v-navigation-drawer location="right" permanent v-if="activeEvent" width="400">
    <v-card>
      <v-card-title>
        <v-btn @click="goToEvent"><v-icon>mdi-checkbook-arrow-right</v-icon></v-btn>
        {{ activeEvent.public_id }}
        <v-chip
          label
          variant="outlined"
          size="x-small"
          :color="activeEvent.type == null ? 'grey' : 'green'"
          class="text-uppercase"
        >
          {{ activeEvent.type || 'NO TYPE SET' }}
        </v-chip>
      </v-card-title>
    </v-card>
    <OriginPanel :origin="activeEvent._po" :action-required="false" compact/>
    <MagnitudePanel :magnitude="activeEvent._pm" :action-required="false" compact/>
  </v-navigation-drawer>
</template>