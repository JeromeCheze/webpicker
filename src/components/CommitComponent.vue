<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import { ref, watch } from 'vue'

const emit = defineEmits(['commit'])

const properties = defineProps<{
  status: string
}>()

const store = useAppStore()

const eventTypeOptions = ref(['not existing', 'other event', 'earthquake', 'quarry blast', 'explosion', 'not reported', 'anthropogenic event', 'collapse', 'cavity collapse', 'mine collapse', 'building collapse', 'accidental explosion', 'chemical explosion', 'controlled explosion', 'experimental explosion', 'industrial explosion', 'mining explosion', 'road cut', 'blasting levee', 'nuclear explosion', 'induced or triggered event', 'rock burst', 'reservoir loading', 'fluid injection', 'fluid extraction', 'crash', 'plane crash', 'train crash', 'boat crash', 'atmospheric event', 'sonic boom', 'sonic blast', 'acoustic noise', 'thunder', 'avalanche', 'snow avalanche', 'debris avalanche', 'hydroacoustic event', 'ice quak', 'slide', 'landslide', 'rockslide', 'meteorite', 'volcanic eruption'])
const eventTypeCertaintyOptions = ref(['known', 'suspected'])
const evaluationStatusOptions = ref(['preliminary', 'confirmed', 'reviewed', 'final', 'rejected'])
const eventType = ref('earthquake')
const eventTypeCertainty = ref()
const evaluationStatus = ref()

watch(() => store.keydown, (newValue) => {
  if (newValue === 'alt+c') {
    emitCommit()
  }
})

function emitCommit() {
  emit('commit', { eventType, eventTypeCertainty, evaluationStatus })
}
</script>

<template>
  <v-menu width="300" offset="18" :close-on-content-click="false">
    <template v-slot:activator="{ props }">
      <v-btn
        v-bind="props"
        title="commit (Alt + C)"
        :color="properties.status === 'required' ? 'orange' : undefined"
        :disabled="properties.status === 'disabled'"
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
        <v-btn @click="emitCommit" size="small">Commit</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>