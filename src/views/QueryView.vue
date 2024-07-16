<script setup lang="ts">
import { ref, onMounted } from 'vue'
// import { type EventParameter } from '@/lib/sismojs/src/types/index'
import { Event } from '@/lib/sismojs/src/core/event/types'
import { Client } from '@/lib/sismojs/src/fdsn'
import { useAppStore } from '@/stores/app'
import { useRoute } from 'vue-router'

const store = useAppStore()
const route = useRoute()
const client = new Client('.')

const height = document.body.getBoundingClientRect().height - 80
const currentView = ref('list' as 'list' | 'map' | 'stats')
const eventList = ref([] as Event[])
const loading = ref(false)

onMounted(() => {
  if (store.cacheEventList.length > 0) {
    eventList.value = store.cacheEventList
  } else {
    if (Object.keys(route.query).length === 0) {
      return
    }
    loading.value = true
    const params = { ...route.query, format: 'xml' }
    client.getEvents(params).then(response => {
      store.cacheEventList = response
      eventList.value = response
    }).finally(() => {
      loading.value = false
    })
  }
})
</script>

<template>
  <v-row>
    <v-col cols="12" class="d-flex justify-end align-center">
      <v-btn class="ml-2" size="small" @click="currentView = 'list'" :active="currentView === 'list'"><v-icon>mdi-view-list</v-icon></v-btn>
      <v-btn class="ml-2" size="small" @click="currentView = 'map'" :active="currentView === 'map'"><v-icon>mdi-map</v-icon></v-btn>
      <v-btn class="ml-2" size="small" @click="currentView = 'stats'" :active="currentView === 'stats'"><v-icon>mdi-chart-bar</v-icon></v-btn>
    </v-col>
  </v-row>
  <v-row>
    <v-col cols="12">
      <ListEvents :height="height" v-if="currentView === 'list'"/>
      <MapEvents :height="height" v-if="currentView === 'map'"/>
      <EventsStats v-if="currentView === 'stats'"/>
    </v-col>
  </v-row>
  <v-overlay v-model="loading" class="align-center justify-center text-black">
    <v-progress-circular indeterminate color="black"></v-progress-circular>
    Loading...
  </v-overlay>
</template> 