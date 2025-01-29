<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import { deepCopy, toQuakeML } from '@/utils'
import { ref, watch } from 'vue'
import { parse } from '@/lib/sismojs/src/core/event/quakeml'
import { QAmplitude, QEvent, QMagnitude, QOrigin, QResourceIdentifier, QStationMagnitude } from '@/lib/sismojs/src/core/event/types'

const MAG_TYPE_WEIGHT = ['M', 'MLv']

const store = useAppStore()

const computeMagnitudeStations = ref({} as { [netsta: string]: boolean })
const locked = ref(false)

function setMagnitudeStation() {
  if (store.eventManager.current.arrivals == null) {
    return
  }
  const stations: { [netsta: string]: boolean } = {}
  for (const arrival of store.eventManager.current.arrivals) {
    if (arrival.pickID.referredObject != null) {
      const netsta = arrival.pickID.referredObject.waveformID.netsta
      // stations[netsta] = arrival.timeWeight != null && arrival.timeWeight > 0
      stations[netsta] = true
    }
  }
  computeMagnitudeStations.value = stations
}

function computeMagnitudes() {
  if (store.eventManager.status.computeMagnitudes === 'disabled' || locked.value) {
    return
  }
  console.log('[ComputeMagnitudesComponent.computeMagnitudes]')
  locked.value = true
  const saveMainKey = QResourceIdentifier.mainKey
  QResourceIdentifier.mainKey = 'sandbox'
  const origin = deepCopy(store.eventManager.current.origin!.desc)
  delete origin.evaluationStatus
  const event = new QEvent(Object.assign(deepCopy(store.eventManager.current.event!.desc), {
    origin: [origin],
    magnitude: [],
    amplitude: [],
    stationMagnitude: [],
    preferredOriginID: store.eventManager.current.origin!.publicID,
    preferredMagnitudeID: undefined
  }))
  for (const pick of store.eventManager.current.userPicks) {
    event.addPick(pick.desc)
  }
  const po = event.preferredOriginID.referredObject as QOrigin
  const arrivalsToRemove = po.arrival.filter(arrival => !computeMagnitudeStations.value[arrival.pickID.referredObject.waveformID.netsta])
  for (const arrival of arrivalsToRemove) {
    po.deleteArrival(arrival)
  }
  if (po.arrival.length === 0) {
    store.notification.push({ type: 'error', value: 'Empty station list to compute magnitudes' })
    return
  }
  const picksToRemove = event.pick.filter(pick => !computeMagnitudeStations.value[pick.waveformID.netsta])
  for (const pick of picksToRemove) {
    event.deletePick(pick)
  }
  store.notification.push({ type: 'progress', value: { text: 'Compute magnitudes...', percent: -1 } })
  QResourceIdentifier.mainKey = saveMainKey
  console.log(`[ComputeMagnitudeComponent] POST: ${JSON.stringify([event.desc])}`)
  fetch(`../api/compute_magnitudes`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    // body: JSON.stringify([event.desc])
    body: toQuakeML(event.desc)
  }).then(response => {
    locked.value = false
    store.notification.push({ type: 'progress', value: null })
    console.log(`[ComputeMagnitudeComponent] response status: ${response.status}`)
    if (response.status === 200) {
      response.json().then(statusResponse => {
        console.log(`[ComputeMagnitudeComponent] result: ${JSON.stringify(statusResponse)}`)
        if (statusResponse.quakeml !== '') {
          try {
            const doc = new DOMParser().parseFromString(statusResponse.quakeml, 'application/xml')
            const saveMainKey = QResourceIdentifier.mainKey
            QResourceIdentifier.mainKey = 'sandbox'
            const result = parse(doc) as QEvent[]
            QResourceIdentifier.mainKey = saveMainKey
            result[0].magnitude.sort((a, b) => {
              const aa = MAG_TYPE_WEIGHT.indexOf(a.type!)
              const bb = MAG_TYPE_WEIGHT.indexOf(b.type!)
              return aa < bb ? -1 : aa > bb ? 1 : 0
            })
            for (const amplitude of result[0].amplitude) {
              new QAmplitude(amplitude.desc, store.eventManager.current.event!.id)
            }
            for (const staMag of result[0].stationMagnitude) {
              new QStationMagnitude(staMag.desc, store.eventManager.current.event!.id)
            }
            const originMagnitudes: QMagnitude[] = []
            for (const magnitude of result[0].magnitude) {
              originMagnitudes.push(new QMagnitude(magnitude.desc, store.eventManager.current.event!.id))
            }
            store.eventManager.current.magnitude = originMagnitudes.slice(-1)[0]
            store.eventManager.current.originMagnitudes = originMagnitudes
            store.eventManager.status.computeMagnitudes = 'enabled'
            store.eventManager.status.commit = 'required'
          } catch (error) {
            console.log(`[ComputeMagnitudeComponent] error: ${error}`)
            alert(statusResponse.message)
          }
        } else {
          console.log(`[ComputeMagnitudeComponent] result: ${statusResponse.message}`)
          alert(statusResponse.message)
        }
      })
    }
  })
}

watch(() => store.eventManager.current.arrivals, () => {
  setMagnitudeStation()
}, { immediate: true })

watch(() => store.keydown, (newValue) => {
  if (newValue === store.settings['keybinding.computeMagnitudes']) {
    computeMagnitudes()
  }
})
</script>

<template>
  <v-menu width="400" offset="18" :close-on-content-click="false" attach>
    <template #activator="{ props }">
      <v-btn
        v-bind="props"
        :title="`compute magnitudes (${store.settings['keybinding.computeMagnitudes']})`"
        :color="store.eventManager.status.computeMagnitudes === 'required' ? 'orange' : undefined"
        :disabled="store.eventManager.status.computeMagnitudes === 'disabled'"
      >
        M
        <template #append>
          <v-icon>mdi-triangle-small-down</v-icon>
        </template>
      </v-btn>
    </template>
    <v-card>
      <v-card-text>
        <v-row>
          <v-col cols="12">
            Stations used for magnitudes computation
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="4" class="py-1" v-for="netsta in Object.keys(computeMagnitudeStations).sort()">
            <input
              v-model="computeMagnitudeStations[netsta]"
              type="checkbox"> {{ netsta }}
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions class="justify-center">
        <v-btn @click="computeMagnitudes" size="small">Compute</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>