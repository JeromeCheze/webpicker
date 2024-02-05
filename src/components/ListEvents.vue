<script setup lang="ts">
import { ref } from 'vue'
import { type EventParameter } from '@/lib/sismojs/src/types/index'
import type { ColObject } from '@/types'
import router from '@/router'

const props = defineProps<{
  events: EventParameter[]
  active?: EventParameter
  height: number
}>()

const header = ref([
  {
    label: 'Time',
    valueAccessor: (e: EventParameter) => e._po?.time._value,
    textAccessor: (e: EventParameter) => e._po?.time._pretty,
    enabled: true
  },
  {
    label: 'M',
    valueAccessor: (e: EventParameter) => e._pm?.mag.value,
    textAccessor: (e: EventParameter) => e._pm?.mag._pretty,
    enabled: true
  },
  {
    label: 'MT',
    valueAccessor: (e: EventParameter) => e._pm?.type,
    textAccessor: (e: EventParameter) => e._pm?.type,
    enabled: false
  },
  {
    label: 'Ph.',
    valueAccessor: (e: EventParameter) => e._po?.quality?.used_phase_count,
    textAccessor: (e: EventParameter) => e._po?.quality?.used_phase_count,
    class: () => 'text-right',
    enabled: true
  },
  {
    label: 'Lat',
    valueAccessor: (e: EventParameter) => e._po?.latitude.value,
    textAccessor: (e: EventParameter) => e._po?.latitude._pretty,
    enabled: true
  },
  {
    label: 'Lon',
    valueAccessor: (e: EventParameter) => e._po?.longitude.value,
    textAccessor: (e: EventParameter) => e._po?.longitude._pretty,
    enabled: true
  },
  {
    label: 'Depth',
    valueAccessor: (e: EventParameter) => e._po?.depth.value,
    textAccessor: (e: EventParameter) => e._po?.depth._pretty,
    enabled: true
  },
  {
    label: 'RMS',
    valueAccessor: (e: EventParameter) => e._po?.quality?.standard_error,
    textAccessor: (e: EventParameter) => e._po?.quality?.standard_error?.toFixed(2),
    enabled: true
  },
  {
    label: 'Mode',
    valueAccessor: (e: EventParameter) => e._po?.evaluation_mode,
    textAccessor: (e: EventParameter) => e._po?.evaluation_mode === 'manual' ? 'M' : 'A',
    class: (e: EventParameter) => e._po?.evaluation_mode === 'manual' ? 'text-green' : 'text-red',
    enabled: true
  },
  {
    label: 'Status',
    valueAccessor: (e: EventParameter) => e._po?.evaluation_status,
    textAccessor: (e: EventParameter) => e._po?.evaluation_status,
    enabled: false
  },
  {
    label: 'Type',
    valueAccessor: (e: EventParameter) => e.type,
    textAccessor: (e: EventParameter) => e.type,
    enabled: true
  },
  {
    label: 'Region',
    valueAccessor: (e: EventParameter) => e._po?.region,
    textAccessor: (e: EventParameter) => e._po?.region,
    enabled: true
  },
  {
    label: 'Author',
    valueAccessor: (e: EventParameter) => e._po?.creation_info?.author,
    textAccessor: (e: EventParameter) => e._po?.creation_info?.author,
    enabled: true
  },
  {
    label: 'ID',
    valueAccessor: (e: EventParameter) => e.public_id,
    textAccessor: (e: EventParameter) => e.public_id,
    enabled: true
  }
] as ColObject[])

function handleRowClick(event: EventParameter) {
  router.push({ name: 'event', params: { eventid: event.public_id } })
}

function isActive(event: EventParameter) {
  return props.active != null && props.active.public_id === event.public_id
}
</script>

<template>
  <v-card>
    <SmartTable
      :table-height="props.height"
      :items="props.events"
      :cols="header"
      @row-clicked="handleRowClick"
      :active="isActive"
    >
      No events to display<br>
      Go to <router-link :to="{ name: 'form' }">form</router-link> to define query parameters
    </SmartTable>
  </v-card>
</template> 