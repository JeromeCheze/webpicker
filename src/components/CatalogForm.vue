<script setup lang="ts">
import { getLocalStorageDefault, setLocalStorage } from '@/utils'
import { ref, computed, onMounted, watch } from 'vue'
import type { WebpickerForm } from '@/types'
import SelectArea from '@/utils/selectArea'
import { useAppStore } from '@/stores/app'
import { useRouter, useRoute } from 'vue-router'
import * as L from 'leaflet'

const store = useAppStore()
const router = useRouter()
const route = useRoute()

const catalogForm = ref()
const map = ref(null as L.Map | null)
const area = ref(null as SelectArea | null)
const rememberGeoConstraints = ref(getLocalStorageDefault('form', null) != null)
const form = ref(loadForm() as WebpickerForm)
const mapContainer = ref(null as HTMLElement | null)
const starttime = ref(new Date(form.value.start))
const endtime = ref(new Date(form.value.end))

const bounds = computed(() => {
  const fixedMaxLon = form.value.maxlon < form.value.minlon ? form.value.maxlon + 360 : form.value.maxlon
  return [[form.value.minlat, form.value.minlon], [form.value.maxlat, fixedMaxLon]] as L.LatLngTuple[]
})

function loadForm() {
  const now = new Date()
  const start = new Date(now.getTime() - 86400e3 * 7)
  const end = new Date(now.getTime() + 86400e3)
  const savedForm = Object.assign(getLocalStorageDefault('form', {}), route.query)
  const result = {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    minlat: savedForm.minlat != null ? parseFloat(savedForm.minlat) : -90,
    maxlat: savedForm.maxlat != null ? parseFloat(savedForm.maxlat) : 90,
    minlon: savedForm.minlon != null ? parseFloat(savedForm.minlon) : -180,
    maxlon: savedForm.maxlon != null ? parseFloat(savedForm.maxlon) : 180,
    mindepth: savedForm.mindepth != null ? parseFloat(savedForm.mindepth) : 0,
    maxdepth: savedForm.maxdepth != null ? parseFloat(savedForm.maxdepth) : 750
  }

  return result
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
  form.value.minlon = sw[1] < -180 ? sw[1] + 360 : sw[1]
  form.value.maxlat = ne[0]
  form.value.maxlon = ne[1] > 180 ? ne[1] - 360 : ne[1]
}

function applyBoundsToArea() {
  if (area.value == null) {
    return
  }
  area.value.setBounds(bounds.value)
}

function handleSubmit() {
  if (catalogForm.value.validate()) {
    const query: Record<string, string> = {}
    for (const [k, v] of Object.entries(form.value)) {
      if (v != null) {
        query[k] = `${v}`
      }
    }
    if (rememberGeoConstraints.value) {
      setLocalStorage('form', {
        minlat: query.minlat,
        maxlat: query.maxlat,
        minlon: query.minlon,
        maxlon: query.maxlon
      })
    } else {
      localStorage.removeItem('form')
    }
    store.cacheEventList = []
    router.push({ name: 'query', query })
  }
}

function checkLatitude(v: number) {
  return v >= -90 && v <= 90 || 'Invalid value'
}

function checkLongitude(v: number) {
  return v >= -180 && v <= 180 || 'Invalid value'
}

watch([
  () => form.value.minlat,
  () => form.value.maxlat,
  () => form.value.minlon,
  () => form.value.maxlon,
], () => {
  applyBoundsToArea()
})

watch(starttime, (value) => {
  form.value.start = value.toISOString().split('T')[0]
})

watch(endtime, (value) => {
  form.value.end = value.toISOString().split('T')[0]
})

watch(() => form.value.start, (newValue) => {
  starttime.value = new Date(newValue)
})

watch(() => form.value.end, (newValue) => {
  starttime.value = new Date(newValue)
})

onMounted(() => {
  if (map.value == null && area.value == null) {
    initMapAndArea()
  }
})
</script>

<template>
  <v-form @submit.prevent="handleSubmit" ref="catalogForm">
    <v-card max-width="1000" :style="{ marginLeft: 'auto', marginRight: 'auto' }">
      <v-card-title>
        <div class="text-h5 text-medium-emphasis ps-2 py-2">Query catalog</div>
      </v-card-title>
      <v-card-text>
        <v-container fluid>
          <v-row>
            <v-col cols="6">
              <div ref="mapContainer"></div>
            </v-col>
            <v-col cols="6">
              <v-row>
                <v-col cols="6">
                  <DateField density="compact" v-model="starttime" label="Start"/>
                </v-col>
                <v-col cols="6">
                  <DateField density="compact" v-model="endtime" label="End"/>
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="6">
                  <NumberField density="compact" v-model="form.minlat" label="Latitude min" suffix="°" :rules="[checkLatitude]"/>
                </v-col>
                <v-col cols="6">
                  <NumberField density="compact" v-model="form.maxlat" label="Latitude max" suffix="°" :rules="[checkLatitude]"/>
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="6">
                  <NumberField density="compact" v-model="form.minlon" label="Longitude min" suffix="°" :rules="[checkLongitude]"/>
                </v-col>
                <v-col cols="6">
                  <NumberField density="compact" v-model="form.maxlon" label="Longitude max" suffix="°" :rules="[checkLongitude]"/>
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="12">
                  <v-checkbox v-model="rememberGeoConstraints" label="Remember geographical constraints"/>
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="6">
                  <NumberField density="compact" hide-details v-model="form.mindepth" label="Depth min" suffix="km"/>
                </v-col>
                <v-col cols="6">
                  <NumberField density="compact" hide-details v-model="form.maxdepth" label="Depth max" suffix="km"/>
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="6">
                  <NumberField density="compact" hide-details v-model="form.minmag" label="Magnitude min"/>
                </v-col>
                <v-col cols="6">
                  <NumberField density="compact" hide-details v-model="form.maxmag" label="Magnitude max"/>
                </v-col>
              </v-row>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="handleSubmit" type="submit" color="blue">Submit</v-btn>
      </v-card-actions>
    </v-card>
  </v-form>
</template>
