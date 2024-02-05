<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import SelectArea from '@/utils/selectArea'
import L, { type LatLngTuple } from 'leaflet'
import type { WebpickerForm } from '@/types'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const router = useRouter()
const map = ref(null as L.Map | null)
const area = ref(null as SelectArea | null)
const rememberGeoConstraints = ref(localStorage.getItem('form') != null)
const startMenu = ref(false)
const endMenu = ref(false)
const form = ref(loadForm() as WebpickerForm)
const mapContainer = ref(null as HTMLElement | null)
const pickerStart = ref(new Date(form.value.start))
const pickerEnd = ref(new Date(form.value.end))


const bounds = computed(() => {
  return [[form.value.minlat, form.value.minlon], [form.value.maxlat, form.value.maxlon]] as LatLngTuple[]
})


function loadForm() {
  const now = new Date()
  const start = new Date(now.getTime() - 86400e3 * 7)
  const end = new Date(now.getTime() + 86400e3)
  const savedForm = JSON.parse(localStorage.getItem('form') || '{}')
  const result = {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    minlat: savedForm.minlat != null ? parseFloat(savedForm.minlat) : -90,
    maxlat: savedForm.maxlat != null ? parseFloat(savedForm.maxlat) : 90,
    minlon: savedForm.minlon != null ? parseFloat(savedForm.minlon) : -180,
    maxlon: savedForm.maxlon != null ? parseFloat(savedForm.maxlon) : 180,
    mindepth: 0,
    maxdepth: 750
  }
  return result
}

function allowedStartDate(v: string) {
  const start = new Date(v).getTime()
  const end = new Date(form.value.end).getTime()
  return start < end
}

function allowedEndDate(v: string) {
  const start = new Date(form.value.start).getTime()
  const end = new Date(v).getTime()
  const now = new Date(new Date().toISOString().slice(0, 10)).getTime() + 86400e3
  return end > start && end <= now
}

function initMapAndArea() {
  if (mapContainer.value == null) {
    return
  }
  const container = mapContainer.value
  const width = container.getBoundingClientRect().width
  container.style.height = `${width}px`
  map.value = L.map(container, { trackResize: false, attributionControl: false })
  const worldtopomap = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri, HERE, DeLorme, TomTom, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, <br>Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), swisstopo, MapmyIndia, © OpenStreetMap contributors, and the GIS User Community'
  })
  worldtopomap.addTo(map.value as L.Map)
  L.control.scale({ imperial: false }).addTo(map.value as L.Map)
  area.value = new SelectArea(bounds.value).addTo(map.value as L.Map).on('boundschange', () => applyBoundsToForm())
  map.value.fitBounds(bounds.value)
}

function applyBoundsToForm() {
  if (area.value == null) {
    return
  }
  const b = area.value.getBounds()
  const [ne, sw] = [b[1], b[0]]
  form.value.minlat = sw[0]
  form.value.minlon = sw[1]
  form.value.maxlat = ne[0]
  form.value.maxlon = ne[1]
}

function applyBoundsToArea() {
  if (area.value == null) {
    return
  }
  area.value.setBounds(bounds.value)
}

function handleSubmit() {
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries(form.value)) {
    if (v != null) {
      query[k] = `${v}`
    }
  }
  if (rememberGeoConstraints.value) {
    localStorage.setItem('form', JSON.stringify({
      minlat: query.minlat,
      maxlat: query.maxlat,
      minlon: query.minlon,
      maxlon: query.maxlon
    }))
  } else {
    localStorage.removeItem('form')
  }
  store.cacheEventList = []
  router.push({ name: 'query', query })
}

watch(() => store.keydown, (newValue) => {
  if (newValue === 'enter') {
    handleSubmit()
  }
})

watch([
  () => form.value.minlat,
  () => form.value.maxlat,
  () => form.value.minlon,
  () => form.value.maxlon,
], () => {
  applyBoundsToArea()
})

watch(pickerStart, (newValue) => {
  const t = new Date(newValue.getTime() - newValue.getTimezoneOffset() * 60e3)
  form.value.start = t.toISOString().split('T')[0]
  startMenu.value = false
})

watch(pickerEnd, (newValue) => {
  const t = new Date(newValue.getTime() - newValue.getTimezoneOffset() * 60e3)
  form.value.end = t.toISOString().split('T')[0]
  endMenu.value = false
})

watch(() => form.value.start, (newValue) => {
  pickerStart.value = new Date(newValue)
})

watch(() => form.value.end, (newValue) => {
  pickerEnd.value = new Date(newValue)
})

onMounted(() => {
  if (map.value == null && area.value == null) {
    initMapAndArea()
  }
})
</script>

<template>
  <v-card>
    <v-card-text>
      <v-container fluid>
        <v-row>
          <v-col cols="6">
            <div ref="mapContainer" :style="{ zIndex: 1, height: '400px' }"></div>
          </v-col>
          <v-col cols="6">
            <v-row>
              <v-col cols="6">
                <v-menu offset-y :close-on-content-click="false" v-model="startMenu">
                  <template v-slot:activator="{ props }">
                    <v-text-field density="compact" v-bind="props" v-model="form.start" label="Start" prepend-icon="mdi-calendar"></v-text-field>
                  </template>
                  <v-date-picker v-model="pickerStart" :allowed-dates="allowedStartDate"></v-date-picker>
                </v-menu>
              </v-col>
              <v-col cols="6">
                <v-menu offset-y :close-on-content-click="false" v-model="endMenu">
                  <template v-slot:activator="{ props }">
                    <v-text-field density="compact" v-bind="props" v-model="form.end" label="End" prepend-icon="mdi-calendar"></v-text-field>
                  </template>
                  <v-date-picker v-model="pickerEnd" :allowed-dates="allowedEndDate"></v-date-picker>
                </v-menu>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="6">
                <NumberField v-model="form.minlat" label="Latitude min [°]"/>
              </v-col>
              <v-col cols="6">
                <NumberField v-model="form.maxlat" label="Latitude max [°]"/>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="6">
                <NumberField v-model="form.minlon" label="Longitude min [°]"/>
              </v-col>
              <v-col cols="6">
                <NumberField v-model="form.maxlon" label="Longitude max [°]"/>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12">
                <v-checkbox v-model="rememberGeoConstraints" label="Remember geographical constraints"/>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="6">
                <NumberField v-model="form.mindepth" label="Depth min [km]"/>
              </v-col>
              <v-col cols="6">
                <NumberField v-model="form.maxdepth" label="Depth max [km]"/>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="6">
                <NumberField v-model="form.minmag" label="Magnitude min"/>
              </v-col>
              <v-col cols="6">
                <NumberField v-model="form.maxmag" label="Magnitude max"/>
              </v-col>
            </v-row>
          </v-col>
        </v-row>
      </v-container>
    </v-card-text>
    <v-card-actions>
      <v-spacer></v-spacer>
      <v-btn @click="handleSubmit" color="blue">Submit</v-btn>
    </v-card-actions>
  </v-card>
</template>
