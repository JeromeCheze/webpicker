<script setup lang="ts">
import type { Inventory } from '@/lib/sismojs/src/types'
import { degToKm, kmToDeg, pushUnique } from '@/utils'
import { useAppStore } from '@/stores/app'
import { ref, watch, computed } from 'vue'
import L from 'leaflet'

const emit = defineEmits(['radiusStations'])

const store = useAppStore()

const menu = ref(false)
const radius = ref(store.settings['miscellaneous.defaultRadius'])
const netSelector = ref('*')
const staSelector = ref('*')
const locSelector = ref('*')
const chaSelector = ref('?H?')
const mapContainer = ref()
const map = ref(null as L.Map | null)
const circle = ref(null as L.Circle | null)
const center = ref(null as L.Marker | null)
const resize = ref(null as L.Marker | null)
const stations = ref([] as L.Layer[])

const INSTRUMENT_WEIGHT = ['N', 'H']

const color = computed(() => {
  const rgb = store.settings['color.surface']
  return rgb !== '' ? `rgb(${rgb})` : ''
})

function validate() {
  preview().then(() => {
    const seedidList: string[] = []
    for (const [net, staMap] of Object.entries(store.dataManager.inventoryCache as Inventory)) {
      for (const [sta, staObj] of Object.entries(staMap)) {
        const netsta = `${net}.${sta}`
        if (store.pickMap[netsta] == null) {
          const locchaWeight: [string, number][] = []
          for (const [loc, chaMap] of Object.entries(staObj.location)) {
            for (const [cha, chaList] of Object.entries(chaMap)) {
              for (const chaObj of chaList) {
                const loccha = `${loc}.${cha}`
                const weight = chaObj.sample_rate + INSTRUMENT_WEIGHT.indexOf(cha[1]) * 100
                locchaWeight.push([loccha, weight])
              }
            }
          }
          if (locchaWeight.length > 0) {
            const maxWeight = Math.max.apply(null, locchaWeight.map(x => x[1]))
            for (const loccha of locchaWeight.filter(x => x[1] === maxWeight).map(x => x[0])) {
              pushUnique(seedidList, `${netsta}.${loccha}`)
            }
          }
        }
      }
    }
    menu.value = false
    emit('radiusStations', seedidList)
  })
}

function preview(): Promise<void> {
  return new Promise((resolve, reject) => {
    const toRemove: string[] = []
    for (const [net, staMap] of Object.entries(store.dataManager.inventoryCache as Inventory)) {
      for (const sta of Object.keys(staMap)) {
        const netsta = `${net}.${sta}`
        if (store.pickMap[netsta] == null) {
          toRemove.push(netsta)
        }
      }
    }
    for (const netsta of toRemove) {
      const [net, sta] = netsta.split('.')
      delete store.dataManager.inventoryCache[net][sta]
    }
    const pos = circle.value!.getLatLng()
    const t = store.currentOrigin!.time.value.slice(0, 19)
    store.dataManager.getRadiusInventory(
      '..', t, pos.lat, pos.lng, radius.value,
      netSelector.value, staSelector.value, locSelector.value, chaSelector.value
    ).then(inv => {
      const [lat, lon] = [store.currentOrigin!.latitude.value, store.currentOrigin!.longitude.value]
      store.dataManager.updateStationDistanceAzimuth(lat, lon)
      displayStations()
      resolve()
    })
  })
}

function displayStations() {
  for (const m of stations.value) {
    m.remove()
  }
  for (const [net, staMap] of Object.entries(store.dataManager.inventoryCache as Inventory)) {
    for (const [sta, staObj] of Object.entries(staMap)) {
      const netsta = `${net}.${sta}`
      const m = L.circleMarker([staObj.lat, staObj.lon], {
        radius: 3,
        color: store.pickMap[netsta] != null ? 'green' : 'blue',
        weight: 1,
        fillOpacity: 0.5
      }).addTo(map.value as L.Map)
      stations.value.push(m)
    }
  }
}

function initMap() {
  if (mapContainer.value == null) {
  }
  const container = mapContainer.value
  map.value = L.map(container, { trackResize: false, attributionControl: false })
  const plan = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}')
  const worldtopomap = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}')
  const satmap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
  const baseLayers = { Plan: plan, Terrain: worldtopomap, Satellite: satmap }
  L.control.layers(baseLayers).addTo(map.value as L.Map)
  plan.addTo(map.value as L.Map)
  const pos = [store.currentOrigin!.latitude.value, store.currentOrigin!.longitude.value] as L.LatLngTuple
  circle.value = L.circle(pos, { radius: degToKm(radius.value) * 1e3 }).addTo(map.value as L.Map)
  center.value = L.marker(pos, { icon: L.divIcon({ className: 'circle c-move', iconSize: [10, 10] }), draggable: true }).addTo(map.value as L.Map)
  resize.value = L.marker([pos[0] + radius.value, pos[1]], { icon: L.divIcon({ className: 'circle c-ns-resize', iconSize: [10, 10] }), draggable: true }).addTo(map.value as L.Map)
  center.value.on('drag', () => {
    const newPos = center.value!.getLatLng()
    circle.value!.setLatLng(newPos)
    resize.value!.setLatLng([newPos.lat + radius.value, newPos.lng])
  })
  resize.value.on('drag', () => {
    const dist = circle.value!.getLatLng().distanceTo(resize.value!.getLatLng())
    radius.value = kmToDeg(dist / 1e3)
    circle.value!.setRadius(dist)
  })
  displayStations()
  map.value.setView(pos, 7)
}

watch(() => radius.value, (value) => {
  const pos = circle.value!.getLatLng()
  circle.value!.setRadius(degToKm(value) * 1e3)
  resize.value!.setLatLng([pos.lat + value, pos.lng])
})

watch(() => menu.value, (value) => {
  if (value === true) {
    setTimeout(() => {
      initMap()
    }, 200)
  }
})
</script>

<template>
  <v-menu v-model="menu" :close-on-content-click="false" attach>
    <template v-slot:activator="{ props }">
      <v-btn class="ml-4" v-bind="props"><v-icon>mdi-less-than-or-equal</v-icon></v-btn>
    </template>
    <v-card min-width="500">
      <v-card-text>
        <div ref="mapContainer" :style="{ height: '400px' }"></div>
        <v-row>
          <v-col cols="3">
            <v-text-field v-model="netSelector" label="Network" density="compact" hide-details/>
          </v-col>
          <v-col cols="3">
            <v-text-field v-model="staSelector" label="Station" density="compact" hide-details/>
          </v-col>
          <v-col cols="3">
            <v-text-field v-model="locSelector" label="Location" density="compact" hide-details/>
          </v-col>
          <v-col cols="3">
            <v-text-field v-model="chaSelector" label="Channel" density="compact" hide-details/>
          </v-col>
        </v-row>
      </v-card-text>
      <v-toolbar density="compact" :color="color">
        <NumberField v-model="radius" label="Radius [°]" density="compact" hide-details class="mx-1"/>
        <v-btn @click="preview" class="mx-1">Preview</v-btn>
        <v-btn @click="validate" class="mx-1">Validate</v-btn>
      </v-toolbar>
    </v-card>
  </v-menu>
</template>