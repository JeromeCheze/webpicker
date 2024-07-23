<script setup lang="ts">
import type { Magnitude } from '@/lib/sismojs/src/core/event/types'
import type { ColObject, EventViewStatus } from '@/types'
import { useAppStore } from '@/stores/app'
import { ref } from 'vue'

const store = useAppStore()

const props = defineProps<{
  magnitude?: Magnitude
  status?: EventViewStatus['computeMagnitudesStatus']
  compact?: boolean
}>()

const magnitudeCols = ref([
  {
    label: 'Value',
    valueAccessor: (m: Magnitude) => m.mag,
    textAccessor: (m: Magnitude) => `${m.mag.value.toFixed(2)} +/- ${m.mag.uncertainty?.toFixed(2)}`,
    enabled: true
  },
  {
    label: 'Type',
    valueAccessor: (m: Magnitude) => m.type,
    textAccessor: (m: Magnitude) => m.type,
    enabled: true
  },
  {
    label: 'Nb Station',
    valueAccessor: (m: Magnitude) => m.stationCount,
    textAccessor: (m: Magnitude) => m.stationCount,
    enabled: true
  },
  {
    label: 'Method',
    valueAccessor: (m: Magnitude) => m.methodID,
    textAccessor: (m: Magnitude) => m.methodID,
    enabled: true
  }
] as ColObject[])
</script>

<template>
  <v-card >
    <v-card-title>
      Magnitude
      <v-chip label color="warning" v-if="props.status === 'required'">COMPUTATION REQUIRED</v-chip>
      <v-chip label color="info" v-if="props.magnitude == null">NO MAGNITUDE</v-chip>
    </v-card-title>
    <v-card-text v-if="props.magnitude != null">
      <v-row>
        <v-col :cols="props.compact ? 6 : 4" v-for="col in magnitudeCols" :class="{ 'ma-0': props.compact, 'py-0': props.compact }">
          <v-list density="compact" :bg-color="store.settings['color.surface']">
            <v-list-item
              :title="col.label"
              :subtitle="col.textAccessor(props.magnitude)"
              :class="col.class != null ? col.class(props.magnitude) : ''"/>
          </v-list>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>