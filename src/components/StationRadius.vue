<script setup lang="ts">
import { degToKm, kmToDeg, pushUnique, getLocalStorageDefault, setLocalStorage } from '@/utils'
import type { Inventory } from '@/lib/sismojs/src/types'
import { useAppStore } from '@/stores/app'
import { useRoute } from 'vue-router'
import { onMounted, ref, watch } from 'vue'
import * as L from 'leaflet'

const route = useRoute()

const emit = defineEmits(['radiusStations', 'update:modelValue', 'update:latitude', 'update:longitude'])

const props = defineProps<{
  modelValue: boolean
  latitude: number
  longitude: number
  storageKey: string
  time: number
}>()

const store = useAppStore()

const opt = getLocalStorageDefault(
  props.storageKey,
  Object.assign({
    network: '*',
    station: '*',
    location: '*',
    channel: '?H?',
    radius: store.settings['miscellaneous.defaultRadius']
  }, route.query)
)

const form = ref()
const radius = ref(parseFloat(opt.radius))
const netSelector = ref(opt.network)
const staSelector = ref(opt.station)
const locSelector = ref(opt.location)
const chaSelector = ref(opt.channel)
const mapContainer = ref()
const map = ref(null as L.Map | null)
const circle = ref(null as L.Circle | null)
const center = ref(null as L.Marker | null)
const resize = ref(null as L.Marker | null)
const stations = ref([] as L.Layer[])
const valueRe = /^[A-Z0-9?*,]+$/

const INSTRUMENT_WEIGHT = ['N', 'H']

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
    emit('update:modelValue', false)
    emit('radiusStations', seedidList)
  })
}

function preview(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (form.value.validate()) {
      setLocalStorage(
        props.storageKey,
        {
          network: netSelector.value,
          station: staSelector.value,
          location: locSelector.value,
          channel: chaSelector.value,
          radius: radius.value
        }
      )
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
      const t = new Date(props.time).toISOString().slice(0, 19)
      store.dataManager.getRadiusInventory(
        '..', t, props.latitude, props.longitude, radius.value,
        netSelector.value, staSelector.value, locSelector.value, chaSelector.value
      ).then(inv => {
        const [lat, lon] = [props.latitude, props.longitude]
        store.dataManager.updateStationDistanceAzimuth(lat, lon)
        displayStations()
        resolve()
      })
    } else {
      console.warn('reject')
      reject()
    }
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

function ready(callback?: () => void) {
  if (callback != null) {
    callback()
  }
}

function initMap() {
  if (mapContainer.value == null || map.value != null) {
    return
  }
  console.log('initMap')
  map.value = L.map(mapContainer.value, { trackResize: false, attributionControl: false })
  const plan = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}')
  const worldtopomap = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}')
  const satmap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
  const baseLayers = { Plan: plan, Terrain: worldtopomap, Satellite: satmap }
  L.control.layers(baseLayers).addTo(map.value as L.Map)
  plan.addTo(map.value as L.Map)
  const pos = [props.latitude, props.longitude] as L.LatLngTuple
  circle.value = L.circle(pos, { radius: degToKm(radius.value) * 1e3 }).addTo(map.value as L.Map)
  center.value = L.marker(pos, { icon: L.divIcon({ className: 'circle c-move', iconSize: [10, 10] }), draggable: true }).addTo(map.value as L.Map)
  resize.value = L.marker([pos[0] + radius.value, pos[1]], { icon: L.divIcon({ className: 'circle c-ns-resize', iconSize: [10, 10] }), draggable: true }).addTo(map.value as L.Map)
  center.value.on('drag', () => {
    const newPos = center.value!.getLatLng()
    circle.value!.setLatLng(newPos)
    resize.value!.setLatLng([newPos.lat + radius.value, newPos.lng])
    emit('update:latitude', newPos.lat)
    emit('update:longitude', newPos.lng)
  })
  resize.value.on('drag', () => {
    const dist = circle.value!.getLatLng().distanceTo(resize.value!.getLatLng())
    radius.value = kmToDeg(dist / 1e3)
    circle.value!.setRadius(dist)
  })
  displayStations()
  map.value.setView(pos, 7)
  ready()
}

function checkValue(value: string) {
  return valueRe.test(value) || 'Invalid'
}

watch(() => radius.value, (value) => {
  const pos = circle.value!.getLatLng()
  circle.value!.setRadius(degToKm(value) * 1e3)
  resize.value!.setLatLng([pos.lat + value, pos.lng])
})

watch(() => props.modelValue, (value) => {
  if (value === true) {
    setTimeout(() => {
      initMap()
    }, 200)
  }
})

onMounted(() => {
  initMap()
})

defineExpose({ validate, ready })
</script>

<template>
  <div ref="mapContainer" :style="{ height: '400px' }" class="mb-4"></div>
  <v-form ref="form">
    <v-row>
      <v-col cols="3">
        <v-text-field v-model="netSelector" label="Network" density="compact" hide-details :rules="[checkValue]"/>
      </v-col>
      <v-col cols="3">
        <v-text-field v-model="staSelector" label="Station" density="compact" hide-details :rules="[checkValue]"/>
      </v-col>
      <v-col cols="3">
        <v-text-field v-model="locSelector" label="Location" density="compact" hide-details :rules="[checkValue]"/>
      </v-col>
      <v-col cols="3">
        <v-text-field v-model="chaSelector" label="Channel" density="compact" hide-details :rules="[checkValue]"/>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="6">
        <NumberField v-model="radius" label="Radius [°]" density="compact" hide-details/>
      </v-col>
      <v-col cols="3">
        <v-btn @click="preview">Preview</v-btn>
      </v-col>
      <v-col cols="3">
        <v-btn @click="validate">Validate</v-btn>
      </v-col>
    </v-row>
  </v-form>
</template>