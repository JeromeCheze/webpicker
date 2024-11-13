<script setup lang="ts">
import type { FDSNEventParams } from '@/lib/sismojs/src/types'
import { onBeforeRouteUpdate, useRoute } from 'vue-router'
import EventsStats from '@/components/EventsStats.vue'
import CatalogForm from '@/components/CatalogForm.vue'
import ListEvents from '@/components/ListEvents.vue'
import MapEvents from '@/components/MapEvents.vue'
import { useAppStore } from '@/stores/app'
import { ref, onMounted } from 'vue'


const store = useAppStore()
const route = useRoute()

const height = document.body.getBoundingClientRect().height - 90
const currentView = ref('list' as 'list' | 'map' | 'stats')
const loading = ref(false)
const form = ref(true)
const hideDiscarded = ref(false)

function handleQuery(params: FDSNEventParams) {
  if (Object.keys(params).length > 1) {
    loading.value = true
    store.eventManager.loadEvents('.', params).then(() => {
      form.value = false
    }).finally(() => {
      loading.value = false
    })
  } else {
    console.warn('Cannot get events, no params')
  }
}

onMounted(() => {
  if (store.eventManager.events.length > 0) {
    form.value = false
  } else {
    if (Object.keys(route.query).length > 0) {
      const params = { ...route.query, format: 'xml' }
      handleQuery(params)
    }
  }
})

onBeforeRouteUpdate(async (to, from) => {
  const params = { ...to.query, format: 'xml' }
  handleQuery(params)
})
</script>

<template>
  <v-row>
    <v-col cols="12" class="d-flex justify-end align-center">
      <v-btn class="ml-2" @click="form = !form" :active="form === true"><v-icon>mdi-pencil</v-icon></v-btn>
      <v-btn class="ml-2" @click="hideDiscarded = !hideDiscarded" :active="hideDiscarded === true">hide discarded</v-btn>
      <v-spacer></v-spacer>
      <v-btn-group density="compact" v-if="form === false">
        <v-btn @click="currentView = 'list'" :active="currentView === 'list'"><v-icon>mdi-view-list</v-icon></v-btn>
        <v-btn @click="currentView = 'map'" :active="currentView === 'map'"><v-icon>mdi-map</v-icon></v-btn>
        <v-btn @click="currentView = 'stats'" :active="currentView === 'stats'"><v-icon>mdi-chart-bar</v-icon></v-btn>
      </v-btn-group>
    </v-col>
  </v-row>
  <v-row v-if="form">
    <v-col cols="12">
      <CatalogForm/>
    </v-col>
  </v-row>
  <v-row v-else>
    <v-col cols="12">
      <ListEvents :height="height" v-if="currentView === 'list'" @open-form="form = true" :hide-discarded="hideDiscarded"/>
      <MapEvents :height="height" v-if="currentView === 'map'" :hide-discarded="hideDiscarded"/>
      <EventsStats v-if="currentView === 'stats'" :hide-discarded="hideDiscarded"/>
    </v-col>
  </v-row>
  <v-overlay v-model="loading" class="align-center justify-center text-black">
    <v-progress-circular indeterminate color="black"></v-progress-circular>
    Loading...
  </v-overlay>
</template> 