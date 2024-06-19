<script setup lang="ts">
import { Event } from '@/lib/sismojs/src/core/event/types'
import { useAppStore } from '@/stores/app'
import type { ColObject } from '@/types'
import { getDefault } from '@/utils'
import { ref, watch } from 'vue'
import router from '@/router'

const store = useAppStore()

const props = defineProps<{
  height: number
}>()

const usersEventMap = ref({} as Record<string, string[]>)

const header = ref([
  {
    label: '',
    valueAccessor: (e: Event) => getDefault(usersEventMap.value, e.publicID, []).length > 0,
    textAccessor: (e: Event) => getDefault(usersEventMap.value, e.publicID, []).join(', '),
    icon: 'mdi-account',
    enabled: true
  },
  {
    label: 'Time',
    valueAccessor: (e: Event) => e.preferredOriginID.referredObject.time.object,
    textAccessor: (e: Event) => e.preferredOriginID.referredObject.time.pretty,
    enabled: true
  },
  {
    label: 'M',
    valueAccessor: (e: Event) => e.preferredMagnitudeID.referredObject?.mag.value,
    textAccessor: (e: Event) => e.preferredMagnitudeID.referredObject?.mag.value.toFixed(2),
    enabled: true
  },
  {
    label: 'MT',
    valueAccessor: (e: Event) => e.preferredMagnitudeID.referredObject?.type,
    textAccessor: (e: Event) => e.preferredMagnitudeID.referredObject?.type,
    enabled: false
  },
  {
    label: 'Ph.',
    valueAccessor: (e: Event) => e.preferredOriginID.referredObject.quality?.usedPhaseCount,
    textAccessor: (e: Event) => e.preferredOriginID.referredObject.quality?.usedPhaseCount,
    class: () => 'text-right',
    enabled: true
  },
  {
    label: 'Lat',
    valueAccessor: (e: Event) => e.preferredOriginID.referredObject.latitude.value,
    textAccessor: (e: Event) => e.preferredOriginID.referredObject.latitude.value.toFixed(2),
    enabled: true
  },
  {
    label: 'Lon',
    valueAccessor: (e: Event) => e.preferredOriginID.referredObject.longitude.value,
    textAccessor: (e: Event) => e.preferredOriginID.referredObject.longitude.value.toFixed(2),
    enabled: true
  },
  {
    label: 'Depth',
    valueAccessor: (e: Event) => e.preferredOriginID.referredObject.depth.value,
    textAccessor: (e: Event) => (e.preferredOriginID.referredObject.depth.value / 1e3).toFixed(2),
    enabled: true
  },
  {
    label: 'RMS',
    valueAccessor: (e: Event) => e.preferredOriginID.referredObject.quality?.standardError,
    textAccessor: (e: Event) => e.preferredOriginID.referredObject.quality?.standardError?.toFixed(2),
    enabled: true
  },
  {
    label: 'Mode',
    valueAccessor: (e: Event) => e.preferredOriginID.referredObject.evaluationMode,
    textAccessor: (e: Event) => e.preferredOriginID.referredObject.evaluationMode === 'manual' ? 'M' : 'A',
    class: (e: Event) => e.preferredOriginID.referredObject.evaluationMode === 'manual' ? 'text-green' : 'text-red',
    enabled: true
  },
  {
    label: 'Status',
    valueAccessor: (e: Event) => e.preferredOriginID.referredObject.evaluationStatus,
    textAccessor: (e: Event) => e.preferredOriginID.referredObject.evaluationStatus,
    enabled: false
  },
  {
    label: 'Type',
    valueAccessor: (e: Event) => e.type,
    textAccessor: (e: Event) => e.type,
    enabled: true
  },
  {
    label: 'Region',
    valueAccessor: (e: Event) => e.preferredOriginID.referredObject.region,
    textAccessor: (e: Event) => e.preferredOriginID.referredObject.region.toUpperCase(),
    enabled: true
  },
  {
    label: 'Author',
    valueAccessor: (e: Event) => e.preferredOriginID.referredObject.creationInfo?.author,
    textAccessor: (e: Event) => e.preferredOriginID.referredObject.creationInfo?.author,
    enabled: true
  },
  {
    label: 'ID',
    valueAccessor: (e: Event) => e.publicID,
    textAccessor: (e: Event) => e.publicID,
    enabled: true
  }
] as ColObject[])

function handleRowClick(event: Event) {
  router.push({ name: 'event', params: { eventid: event.publicID } })
}

function handleRowColor(event: Event) {
  return store.currentEvent != null && store.currentEvent.publicID === event.publicID
    ? store.settings['color.activeRowColor']
    : ''
}

watch(() => store.usersActivity, (value) => {
  const result: Record<string, string[]> = {}
  for (const activity of value) {
    if (activity.event !== '') {
      const users = getDefault(result, activity.event, [])
      users.push(activity.author)
      result[activity.event] = users
    }
  }
  usersEventMap.value = result
}, { immediate: true })
</script>

<template>
  <v-card>
    <SmartTable
      :table-height="props.height"
      :items="store.cacheEventList"
      :cols="header"
      :sortCol="1"
      @row-click="handleRowClick"
      :row-color="handleRowColor"
      store-key="eventList"
    >
      No events to display<br>
      Go to <router-link :to="{ name: 'form' }">form</router-link> to define query parameters
    </SmartTable>
  </v-card>
</template> 