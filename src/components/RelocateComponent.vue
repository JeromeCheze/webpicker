<script setup lang="ts">
import type { QEvent, QEventDescription, QArrivalDescription, QPickDescription } from '@/lib/sismojs/src/core/event/types'
import { parse } from '@/lib/sismojs/src/core/event/quakeml'
import { computed, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { deepCopy, getId, getLocalStorageDefault, setLocalStorage } from '@/utils'

const store = useAppStore()

const relocateOptions: { [locator: string]: string[] } = {
  LOCSAT: ['iasp91', 'tab'],
  NonLinLoc: ['puna_3_35_005', 'iasp91', 'prem']
}

const relocParams = getLocalStorageDefault('relocateParams', {
  locator: null,
  profile: null
})

const locators = computed(() => Object.keys(relocateOptions))
const locator = ref(relocParams.locator != null ? relocParams.locator : locators.value[0])
const profiles = computed(() => relocateOptions[locator.value])
const profile = ref(relocParams.profile != null ? relocParams.profile : profiles.value[0])
const locked = ref(false)

watch(() => store.keydown, (newValue) => {
  // console.log(newValue)
  if (newValue === store.settings['keybinding.relocate']) {
    relocate()
  }
})

watch(() => locator.value, (value) => {
  profile.value = relocateOptions[value][0]
})

watch(() => profile.value, () => {
  setLocalStorage('relocateParams', {
    locator: locator.value,
    profile: profile.value
  })
})

function relocate() {
  if (store.currentArrivals.length === 0 || locked.value) {
    return
  }
  locked.value = true
  store.notification.push({ type: 'progress', value: { text: 'Relocate...', percent: -1 } })
  const origin = deepCopy(store.currentOrigin!.desc)
  const pickIds = origin.arrival.map((x: QArrivalDescription) => x.pickID)
  const event: QEventDescription = Object.assign(deepCopy(store.currentEvent!.desc), {
    origin: [origin],
    magnitude: undefined,
    stationMagnitude: undefined,
    amplitude: undefined,
    preferredOriginID: origin['@publicID'],
    preferredMagnitudeID: undefined
  })
  // Keep only pick referred by arrivals
  event.pick = event.pick.filter((x: QPickDescription) => pickIds.indexOf(x['@publicID']) >= 0)
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
          const result = parse(doc) as QEvent[]
          const newOrigin = result[0].origin[0]
          for (const arrival of newOrigin.arrival) {
            arrival.desc['@publicID'] = getId('Arrival')
          }
          newOrigin.creationInfo.author = store.author
          store.eventViewStatus.relocateStatus = 'enabled'
          store.eventViewStatus.computeMagnitudesStatus = 'required'
          store.eventViewStatus.commitStatus = 'enabled'
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
