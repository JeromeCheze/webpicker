<script setup lang="ts">
import type { Origin } from '@/lib/sismojs/src/types'
import { useAppStore } from '@/stores/app'
import { ref, watch, onBeforeMount } from 'vue'

const emit = defineEmits(['computeMagnitudes'])

const properties = defineProps<{
  status: string
  origin: Origin
}>()

const store = useAppStore()

const computeMagnitudeStations = ref({} as { [netsta: string]: boolean })

watch(() => properties.origin, () => {
  setMagnitudeStation()
})

watch(() => store.keydown, (newValue) => {
  if (newValue === 'alt+m') {
    emitComputeMagnitudes()
  }
})

function setMagnitudeStation() {
  const stations: { [netsta: string]: boolean } = {}
  if (properties.origin.arrival != null) {
    for (const arrival of properties.origin.arrival) {
      if (arrival._pick != null) {
        const netsta = `${arrival._pick.waveform_id.network_code}.${arrival._pick.waveform_id.station_code}`
        stations[netsta] = true
      }
    }
  }
  computeMagnitudeStations.value = stations
}

function emitComputeMagnitudes() {
  const netstaList = []
  for (const [netsta, value] of Object.entries(computeMagnitudeStations.value)) {
    if (value) {
      netstaList.push(netsta)
    }
  }
  emit('computeMagnitudes', netstaList)
}

onBeforeMount(() => {
  setMagnitudeStation()
})
</script>

<template>
  <v-menu width="160" offset="18" :close-on-content-click="false">
    <template v-slot:activator="{ props }">
      <v-btn
        v-bind="props"
        title="compute magnitudes (Alt + M)"
        :color="properties.status === 'required' ? 'orange' : undefined"
        :disabled="properties.status === 'disabled'"
      >
        M
        <template v-slot:append>
          <v-icon>mdi-triangle-small-down</v-icon>
        </template>
      </v-btn>
    </template>
    <v-card>
      <v-card-text>
        <div class="mb-2">Stations used for magnitudes computation</div>
        <div v-for="netsta in Object.keys(computeMagnitudeStations).sort()">
          <input
            v-model="computeMagnitudeStations[netsta]"
            type="checkbox"> {{ netsta }}
        </div>
      </v-card-text>
      <v-card-actions class="justify-center">
        <v-btn @click="emitComputeMagnitudes" size="small">Compute</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>