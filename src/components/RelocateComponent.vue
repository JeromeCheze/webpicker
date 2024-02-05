<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'

const emit = defineEmits(['relocate'])

const properties = defineProps<{
  status: string
}>()

const relocateOptions: { [locator: string]: string[] } = {
  LOCSAT: [ 'iasp91', 'tab' ],
  NonLinLoc: [ 'iasp91', 'prem' ]
}

const locators = computed(() => Object.keys(relocateOptions))
const locator = ref(locators.value[0])
const profiles = computed(() => relocateOptions[locator.value])
const profile = ref(profiles.value[0])
</script>

<template>
  <v-menu width="300" offset="18" :close-on-content-click="false">
    <template v-slot:activator="{ props }">
      <v-btn
        v-bind="props"
        title="relocate (Alt + R)"
        :color="properties.status === 'required' ? 'orange' : undefined"
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
        <v-btn @click="emit('relocate')" size="small">Relocate</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>