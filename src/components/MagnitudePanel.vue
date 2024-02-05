<script setup lang="ts">
import type { ColObject, EventViewStatus } from '@/types'
import type { Magnitude } from '@/lib/sismojs/src/types'
import { ref } from 'vue'

const props = defineProps<{
  magnitude?: Magnitude
  status?: EventViewStatus['computeMagnitudesStatus']
  compact?: boolean
}>()

const magnitudeCols = ref([
  {
    label: 'Value',
    valueAccessor: (m: Magnitude) => m.mag.value,
    textAccessor: (m: Magnitude) => m.mag._pretty,
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
    valueAccessor: (m: Magnitude) => m.station_count,
    textAccessor: (m: Magnitude) => m.station_count,
    enabled: true
  },
  {
    label: 'Method',
    valueAccessor: (m: Magnitude) => m.method_id,
    textAccessor: (m: Magnitude) => m.method_id,
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
          <v-list density="compact">
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