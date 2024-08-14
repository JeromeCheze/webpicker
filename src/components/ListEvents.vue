<script setup lang="ts">
import { getDefault, getLocalStorageDefault } from '@/utils'
import { QEvent } from '@/lib/sismojs/src/core/event/types'
import { useAppStore } from '@/stores/app'
import type { ColObject } from '@/types'
import { ref, watch } from 'vue'
import router from '@/router'

const emit = defineEmits(['openForm'])

const store = useAppStore()

const props = defineProps<{
  height: number
}>()

const usersEventMap = ref({} as Record<string, string[]>)

const header = ref([
  {
    label: '',
    valueAccessor: (e: QEvent) => getDefault(usersEventMap.value, e.publicID, []).length > 0,
    textAccessor: (e: QEvent) => getDefault(usersEventMap.value, e.publicID, []).join(', '),
    icon: 'mdi-account',
    enabled: true
  },
  {
    label: 'Time',
    valueAccessor: (e: QEvent) => e.preferredOriginID.referredObject.time.object,
    textAccessor: (e: QEvent) => e.preferredOriginID.referredObject.time.pretty,
    enabled: true
  },
  {
    label: 'M',
    valueAccessor: (e: QEvent) => e.preferredMagnitudeID.referredObject?.mag.value,
    textAccessor: (e: QEvent) => e.preferredMagnitudeID.referredObject?.mag.value.toFixed(2),
    enabled: true
  },
  {
    label: 'MT',
    valueAccessor: (e: QEvent) => e.preferredMagnitudeID.referredObject?.type,
    textAccessor: (e: QEvent) => e.preferredMagnitudeID.referredObject?.type,
    enabled: false
  },
  {
    label: 'Ph.',
    valueAccessor: (e: QEvent) => e.preferredOriginID.referredObject.quality?.usedPhaseCount,
    textAccessor: (e: QEvent) => e.preferredOriginID.referredObject.quality?.usedPhaseCount,
    class: () => 'text-right',
    enabled: true
  },
  {
    label: 'Lat',
    valueAccessor: (e: QEvent) => e.preferredOriginID.referredObject.latitude.value,
    textAccessor: (e: QEvent) => e.preferredOriginID.referredObject.latitude.value.toFixed(2),
    enabled: true
  },
  {
    label: 'Lon',
    valueAccessor: (e: QEvent) => e.preferredOriginID.referredObject.longitude.value,
    textAccessor: (e: QEvent) => e.preferredOriginID.referredObject.longitude.value.toFixed(2),
    enabled: true
  },
  {
    label: 'Depth',
    valueAccessor: (e: QEvent) => e.preferredOriginID.referredObject.depth.value,
    textAccessor: (e: QEvent) => (e.preferredOriginID.referredObject.depth.value / 1e3).toFixed(2),
    enabled: true
  },
  {
    label: 'RMS',
    valueAccessor: (e: QEvent) => e.preferredOriginID.referredObject.quality?.standardError,
    textAccessor: (e: QEvent) => e.preferredOriginID.referredObject.quality?.standardError?.toFixed(2),
    enabled: true
  },
  {
    label: 'Mode',
    valueAccessor: (e: QEvent) => e.preferredOriginID.referredObject.evaluationMode,
    textAccessor: (e: QEvent) => e.preferredOriginID.referredObject.evaluationMode === 'manual' ? 'M' : 'A',
    class: (e: QEvent) => e.preferredOriginID.referredObject.evaluationMode === 'manual' ? 'text-green' : 'text-red',
    enabled: true
  },
  {
    label: 'Status',
    valueAccessor: (e: QEvent) => e.preferredOriginID.referredObject.evaluationStatus,
    textAccessor: (e: QEvent) => e.preferredOriginID.referredObject.evaluationStatus,
    enabled: false
  },
  {
    label: 'Type',
    valueAccessor: (e: QEvent) => e.type,
    textAccessor: (e: QEvent) => e.type,
    enabled: true
  },
  {
    label: 'Region',
    valueAccessor: (e: QEvent) => e.preferredOriginID.referredObject.region,
    textAccessor: (e: QEvent) => e.preferredOriginID.referredObject.region.toUpperCase(),
    enabled: true
  },
  {
    label: 'Author',
    valueAccessor: (e: QEvent) => e.preferredOriginID.referredObject.creationInfo?.author,
    textAccessor: (e: QEvent) => e.preferredOriginID.referredObject.creationInfo?.author,
    enabled: true
  },
  {
    label: 'ID',
    valueAccessor: (e: QEvent) => e.publicID,
    textAccessor: (e: QEvent) => e.publicID,
    enabled: true
  }
] as ColObject[])

function handleRowClick(event: QEvent) {
  router.push({ name: 'event', params: { eventid: event.publicID } })
}

function handleRowColor(event: QEvent) {
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
      :sort-col="getLocalStorageDefault('eventList._sortCol', 1)"
      :sort-order="getLocalStorageDefault('eventList._sortOrder', 'desc')"
      @row-click="handleRowClick"
      :row-color="handleRowColor"
      store-key="eventList"
    >
      No events to display<br>
      <v-btn variant="text" @click="emit('openForm')" color="primary">open form</v-btn>
    </SmartTable>
  </v-card>
</template>
