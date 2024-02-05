<script setup lang="ts">
import type { ColObject, EventViewStatus } from '@/types'
import type { Origin } from '@/lib/sismojs/src/types'
import { ref } from 'vue'

const props = defineProps<{
  origin?: Origin
  status?: EventViewStatus['relocateStatus']
  compact?: boolean
}>()

const originCols = ref([
  {
    label: 'Time',
    valueAccessor: (o: Origin) => o.time._value,
    textAccessor: (o: Origin) => o.time._pretty,
    enabled: true
  },
  {
    label: 'Latitude',
    valueAccessor: (o: Origin) => o.latitude.value,
    textAccessor: (o: Origin) => `${o.latitude._pretty} ${o.latitude._pretty_uncertainty}`,
    enabled: true
  },
  {
    label: 'Longitude',
    valueAccessor: (o: Origin) => o.longitude.value,
    textAccessor: (o: Origin) => `${o.longitude._pretty} ${o.longitude._pretty_uncertainty}`,
    enabled: true
  },
  {
    label: 'Depth',
    valueAccessor: (o: Origin) => o.depth.value,
    textAccessor: (o: Origin) => `${o.depth._pretty} ${o.depth._pretty_uncertainty}`,
    class: depthColor,
    enabled: true
  },
  {
    label: 'Phases',
    valueAccessor: (o: Origin) => o.quality?.used_phase_count,
    textAccessor: (o: Origin) => `${o.quality?.used_phase_count} / ${o.quality?.associated_phase_count}`,
    enabled: true
  },
  {
    label: 'RMS',
    valueAccessor: (o: Origin) => o.quality?.standard_error,
    textAccessor: (o: Origin) => `${o.quality?.standard_error?.toFixed(2)} s`,
    class: rmsColor,
    enabled: true
  },
  {
    label: 'Az. Gap',
    valueAccessor: (o: Origin) => o.quality?.azimuthal_gap,
    textAccessor: (o: Origin) => `${o.quality?.azimuthal_gap?.toFixed(0)} °`,
    class: azGapColor,
    enabled: true
  },
  {
    label: 'Min Dist',
    valueAccessor: (o: Origin) => o.quality?.minimum_distance,
    textAccessor: (o: Origin) => `${o.quality?.minimum_distance?.toFixed(2)} °`,
    class: minDistColor,
    enabled: true
  },
  {
    label: 'Method',
    valueAccessor: (o: Origin) => o.method_id,
    textAccessor: (o: Origin) => o.method_id,
    enabled: false
  },
  {
    label: 'Earth Model',
    valueAccessor: (o: Origin) => o.earth_model_id,
    textAccessor: (o: Origin) => o.earth_model_id,
    enabled: false
  },
  {
    label: 'Author',
    valueAccessor: (o: Origin) => o.creation_info?.author,
    textAccessor: (o: Origin) => o.creation_info?.author,
    enabled: false
  },
  {
    label: 'Ceation Time',
    valueAccessor: (o: Origin) => o.creation_info?._creation_time,
    textAccessor: (o: Origin) => o.creation_info?._pretty_creation_time,
    enabled: false
  }
] as ColObject[])

function rmsColor(o: Origin) {
  if (o.quality != null && o.quality.standard_error != null) {
    return o.quality.standard_error > 2
      ? 'text-red'
      : o.quality.standard_error > 1
        ? 'text-orange'
        : ''
  }
  return ''
}

function azGapColor(o: Origin) {
  if (o.quality != null && o.quality.azimuthal_gap != null) {
    return o.quality.azimuthal_gap > 250
      ? 'text-red'
      : o.quality.azimuthal_gap > 180
        ? 'text-orange'
        : ''
  }
  return ''
}

function minDistColor(o: Origin) {
  if (o.quality != null && o.quality.minimum_distance != null) {
    return o.quality.minimum_distance > 1
      ? 'text-red'
      : o.quality.minimum_distance > 0.5
        ? 'text-orange'
        : ''
  }
  return ''
}

function depthColor(o: Origin) {
  return o.depth.value > 300000
    ? 'text-red'
    : o.depth.value > 150000
      ? 'text-orange'
      : ''
}
</script>

<template>
  <v-card>
    <v-card-title>
      Origin
      <v-chip label color="warning" v-if="props.status === 'required'">RELOCATION REQUIRED</v-chip>
    </v-card-title>
    <v-card-text>
      <v-row>
        <v-col :cols="props.compact ? 6 : 3" v-for="col in originCols" :class="{ 'ma-0': props.compact, 'py-0': props.compact }">
          <v-list density="compact" v-if="props.origin != null">
            <v-list-item
              :title="col.label"
              :subtitle="col.textAccessor(props.origin)"
              :class="col.class != null ? col.class(props.origin) : ''"/>
          </v-list>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>