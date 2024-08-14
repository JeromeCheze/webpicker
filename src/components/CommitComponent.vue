<script setup lang="ts">
import { QEvent, QStationMagnitude } from '@/lib/sismojs/src/core/event/types'
import { useAppStore } from '@/stores/app'
import { deepCopy } from '@/utils'
import { ref, watch } from 'vue'

const store = useAppStore()

const emit = defineEmits(['update'])

const eventTypeOptions = ref(['not existing', 'other event', 'earthquake', 'quarry blast', 'explosion', 'not reported', 'anthropogenic event', 'collapse', 'cavity collapse', 'mine collapse', 'building collapse', 'accidental explosion', 'chemical explosion', 'controlled explosion', 'experimental explosion', 'industrial explosion', 'mining explosion', 'road cut', 'blasting levee', 'nuclear explosion', 'induced or triggered event', 'rock burst', 'reservoir loading', 'fluid injection', 'fluid extraction', 'crash', 'plane crash', 'train crash', 'boat crash', 'atmospheric event', 'sonic boom', 'sonic blast', 'acoustic noise', 'thunder', 'avalanche', 'snow avalanche', 'debris avalanche', 'hydroacoustic event', 'ice quak', 'slide', 'landslide', 'rockslide', 'meteorite', 'volcanic eruption'])
const eventTypeCertaintyOptions = ref(['known', 'suspected'])
const evaluationStatusOptions = ref(['preliminary', 'confirmed', 'reviewed', 'final', 'rejected'])
const eventType = ref('earthquake')
const eventTypeCertainty = ref()
const evaluationStatus = ref()
const locked = ref(false)

watch(() => store.keydown, (newValue) => {
  if (newValue === store.settings['keybinding.commit']) {
    commit()
  }
})

function commit() {
  if (store.eventViewStatus.commitStatus === 'disabled' || locked.value) {
    return
  }
  locked.value = true
  store.notification.push({ type: 'progress', value: { text: 'Commit...', percent: -1 } })
  const event = new QEvent(deepCopy(store.currentEvent!.desc))
  if (event.origin.find(x => x.publicID === store.currentOrigin!.publicID) == null) {
    event.addOrigin(store.currentOrigin!.desc)
    event.setPreferredOriginID(store.currentOrigin!.publicID)
  }
  for (const m of store.currentOriginMagnitudes) {
    if (event.magnitude.find(x => x.publicID === m.publicID) == null) {
      event.addMagnitude(m.desc)
      if (m.stationMagnitudeContribution != null) {
        for (const smc of m.stationMagnitudeContribution) {
          const staMag: QStationMagnitude = smc.stationMagnitudeID.referredObject
          if (event.stationMagnitude.find(x => x.publicID === staMag.publicID) == null) {
            event.addStationMagnitude(staMag.desc)
          }
          const amp = staMag.amplitudeID.referredObject
          if (event.amplitude.find(x => x.publicID === amp.publicID) == null) {
            event.addAmplitude(amp.desc)
          }
        }
      }
    }
  }
  if (store.currentMagnitude != null) {
    event.setPreferredMagnitudeID(store.currentMagnitude.publicID)
  }
  if (store.currentFocalMechanism != null) {
    if (event.focalMechanism.find(x => x.publicID === store.currentFocalMechanism!.publicID) == null) {
      event.addFocalMechanism(store.currentFocalMechanism.desc)
    }
    event.setPreferredFocalMechanismID(store.currentFocalMechanism.publicID)
  }
  event.type = eventType.value
  if (eventTypeCertainty.value != null) {
    event.typeCertainty = eventTypeCertainty.value
  }
  if (evaluationStatus.value != null) {
    event.preferredOriginID.referredObject.evaluationStatus = evaluationStatus.value
  }
  fetch(`../api/commit`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify([event.desc])
  }).then(response => {
    locked.value = false
    store.notification.push({ type: 'progress', value: null })
    if (response.status === 200) {
      response.json().then(statusResponse => {
        if (statusResponse.message != null) {
          store.notification.push({ type: 'warning', value: statusResponse.message })
        }
        if (statusResponse.return_code === 0) {
          emit('update')
        }
      })
    }
  })
}
</script>

<template>
  <v-menu width="300" offset="18" :close-on-content-click="false" attach>
    <template v-slot:activator="{ props }">
      <v-btn
        v-bind="props"
        :title="`commit (${store.settings['keybinding.commit']})`"
        :color="store.eventViewStatus.commitStatus === 'required' ? 'orange' : undefined"
        :disabled="store.eventViewStatus.commitStatus === 'disabled'"
      >
        <v-icon>mdi-content-save-edit</v-icon>
        <template v-slot:append>
          <v-icon>mdi-triangle-small-down</v-icon>
        </template>
      </v-btn>
    </template>
    <v-card>
      <v-card-text>
        <v-select density="compact" label="Type" :items="eventTypeOptions" v-model="eventType"></v-select>
        <v-select density="compact" label="Type certainty" :items="eventTypeCertaintyOptions" v-model="eventTypeCertainty"></v-select>
        <v-select density="compact" label="Status" :items="evaluationStatusOptions" v-model="evaluationStatus"></v-select>
      </v-card-text>
      <v-card-actions class="justify-center">
        <v-btn @click="commit" size="small">Commit</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>
