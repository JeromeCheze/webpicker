<script setup lang="ts">
import type { Event, ArrivalDescription, PickDescription } from '@/lib/sismojs/src/core/event/types'
import { parse } from '@/lib/sismojs/src/core/event/quakeml'
import { computed, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { deepCopy, getId } from '@/utils'

const store = useAppStore()

const relocateOptions: { [locator: string]: string[] } = {
  LOCSAT: ['iasp91', 'tab'],
  NonLinLoc: ['puna_3_35_005', 'iasp91', 'prem']
}

const locators = computed(() => Object.keys(relocateOptions))
const locator = ref(locators.value[0])
const profiles = computed(() => relocateOptions[locator.value])
const profile = ref(profiles.value[0])
const locked = ref(false)

watch(() => store.keydown, (newValue) => {
  // console.log(newValue)
  if (newValue === store.settings['keybinding.relocate']) {
    relocate()
  }
})

function relocate() {
  if (store.currentArrivals.length === 0 || locked.value) {
    return
  }
  locked.value = true
  store.notification.push({ type: 'progress', value: { text: 'Relocate...', percent: -1 } })
  const origin = deepCopy(store.currentOrigin!.desc)
  const pickIds = origin.arrival.map((x: ArrivalDescription) => x.pickID)
  const event = Object.assign(deepCopy(store.currentEvent!.desc), {
    origin: [origin],
    magnitude: undefined,
    station_magnitude: undefined,
    amplitude: undefined,
    preferred_origin_id: origin.public_id,
    preferred_magnitude_id: undefined
  })
  // Keep only pick referred by arrivals
  event.pick = event.pick.filter((x: PickDescription) => pickIds.indexOf(x['@publicID']) >= 0)
  fetch(`../api/relocate?locator=${locator.value}&profile=${profile.value}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify([event])
  }).then(response => {
    locked.value = false
    store.notification.push({ type: 'progress', value: null })
    if (response.status === 200) {
      response.json().then(statusResponse => {
        if (statusResponse.message !== '') {
          alert(statusResponse.message)
        }
        if (statusResponse.quakeml !== '') {
          const doc = new DOMParser().parseFromString(statusResponse.quakeml, 'application/xml')
          const result = parse(doc) as Event[]
          const newOrigin = result[0].origin[0]
          for (const arrival of newOrigin.arrival) {
            arrival.desc['@publicID'] = getId('Arrival')
          }
          newOrigin.creationInfo.author = store.author
          store.eventViewStatus.relocateStatus = 'enabled'
          store.eventViewStatus.computeMagnitudesStatus = 'required'
          store.eventViewStatus.commitStatus = 'disabled'
          store.currentMagnitude = null
          store.currentOriginMagnitudes = []
          store.dataManager.updateStationDistanceAzimuth(newOrigin.latitude.value, newOrigin.longitude.value)
          store.currentArrivals = newOrigin.arrival
          store.currentOrigin = newOrigin
          store.dataManager.clearTTTCache()
          store.updatePickMap()
        }
      })
    } else {
      store.notification.push({ type: 'warning', value: `Error: ${response.status} (${response.statusText})` })
    }
  })
}
</script>

<template>
  <v-menu width="300" offset="18" :close-on-content-click="false" attach>
    <template v-slot:activator="{ props }">
      <v-btn
        v-bind="props"
        :title="`relocate (${store.settings['keybinding.relocate']})`"
        :color="store.eventViewStatus.relocateStatus === 'required' ? 'orange' : undefined"
        :disabled="store.currentArrivals!.length === 0"
      >
        <v-icon>mdi-crosshairs-gps</v-icon>
        <template v-slot:append>
          <v-icon>mdi-triangle-small-down</v-icon>
        </template>
      </v-btn>
    </template>
    <v-card>
      <v-card-text>
        <v-select density="compact" label="Locator" :items="locators" v-model="locator"></v-select>
        <v-select density="compact" label="Profile" :items="profiles" v-model="profile"></v-select>
      </v-card-text>
      <v-card-actions class="justify-center">
        <v-btn @click="relocate" size="small">Relocate</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>
