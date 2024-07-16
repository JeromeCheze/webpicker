<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import { ref, watch } from 'vue'

const emit = defineEmits(['additionalChannels'])

const props = defineProps<{
  seedids: string[]
}>()

const store = useAppStore()

const menu = ref(false)
const channels = ref([] as string[])
const selectedChannels = ref({} as Record<string, boolean>)

watch(() => props.seedids, (value) => {
  if (value.length > 0) {
    const [net, sta] = value[0].split('.').slice(0, 2)
    const ch = store.dataManager.getStationChannels(net, sta).filter(x => value.indexOf(x) < 0)
    ch.sort()
    const tmp: Record<string, boolean> = {}
    for (const seedid of ch) {
      tmp[seedid] = false
    }
    selectedChannels.value = tmp
    channels.value = ch
  }
})

function handleValidate() {
  const result = []
  for (const [seedid, selected] of Object.entries(selectedChannels.value)) {
    if (selected) {
      result.push(seedid)
    }
  }
  emit('additionalChannels', result)
}
</script>

<template>
  <v-menu v-model="menu" :close-on-content-click="false" attach>
    <template v-slot:activator="{ props }">
      <v-btn class="ml-4" v-bind="props" :disabled="channels.length === 0" title="Add additional channels"><v-icon>mdi-playlist-plus</v-icon></v-btn>
    </template>
    <v-card>
      <v-list>
        <v-list-item v-for="seedid in channels" :title="seedid">
          <template v-slot:prepend>
            <v-checkbox-btn v-model="selectedChannels[seedid]"></v-checkbox-btn>
          </template>
        </v-list-item>
      </v-list>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn density="compact" color="primary" @click="handleValidate">Validate</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>