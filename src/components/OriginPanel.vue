<script setup lang="ts">
import { QOrigin, QRealQuantity } from '@/lib/sismojs/src/core/event/types'
import type { ColObject, EventViewStatus } from '@/types'
import { useAppStore } from '@/stores/app'
import { ref } from 'vue'

const store = useAppStore()

const props = defineProps<{
  origin?: QOrigin
  status?: EventViewStatus['relocateStatus']
  compact?: boolean
}>()

const originCols = ref([
  {
    label: 'Time',
    valueAccessor: (o: QOrigin) => o.time.object,
    textAccessor: (o: QOrigin) => o.time.pretty,
    enabled: true
  },
  {
    label: 'Latitude',
    valueAccessor: (o: QOrigin) => o.latitude.value,
    textAccessor: (o: QOrigin) => prettyLatitude(o.latitude),
    enabled: true
  },
  {
    label: 'Longitude',
    valueAccessor: (o: QOrigin) => o.longitude.value,
    textAccessor: (o: QOrigin) => prettyLongitude(o.longitude),
    enabled: true
  },
  {
    label: 'Depth',
    valueAccessor: (o: QOrigin) => o.depth.value,
    textAccessor: (o: QOrigin) => prettyDepth(o.depth),
    class: depthColor,
    enabled: true
  },
  {
    label: 'Phases',
    valueAccessor: (o: QOrigin) => o.quality?.usedPhaseCount,
    textAccessor: (o: QOrigin) => `${o.quality?.usedPhaseCount} / ${o.quality?.associatedPhaseCount}`,
    enabled: true
  },
  {
    label: 'RMS',
    valueAccessor: (o: QOrigin) => o.quality?.standardError,
    textAccessor: (o: QOrigin) => `${o.quality?.standardError?.toFixed(2)} s`,
    class: rmsColor,
    enabled: true
  },
  {
    label: 'Az. Gap',
    valueAccessor: (o: QOrigin) => o.quality?.azimuthalGap,
    textAccessor: (o: QOrigin) => `${o.quality?.azimuthalGap?.toFixed(0)} °`,
    class: azGapColor,
    enabled: true
  },
  {
    label: 'Min Dist',
    valueAccessor: (o: QOrigin) => o.quality?.minimumDistance,
    textAccessor: (o: QOrigin) => `${o.quality?.minimumDistance?.toFixed(2)} °`,
    class: minDistColor,
    enabled: true
  },
  {
    label: 'Method',
    valueAccessor: (o: QOrigin) => o.methodID,
    textAccessor: (o: QOrigin) => o.methodID,
    enabled: false
  },
  {
    label: 'Earth Model',
    valueAccessor: (o: QOrigin) => o.earthModelID,
    textAccessor: (o: QOrigin) => o.earthModelID,
    enabled: false
  },
  {
    label: 'Author',
    valueAccessor: (o: QOrigin) => o.creationInfo?.author,
    textAccessor: (o: QOrigin) => o.creationInfo?.author,
    enabled: false
  },
  {
    label: 'Creation Time',
    valueAccessor: (o: QOrigin) => o.creationInfo?.creationTime,
    textAccessor: (o: QOrigin) => o.creationInfo?.creationTime,
    enabled: false
  }
] as ColObject[])

function prettyLatitude(lat: QRealQuantity) {
  return lat.value > 0
    ? `${lat.value.toFixed(2)}°N +/- ${lat.uncertainty?.toFixed(2)} km`
    : `${-lat.value.toFixed(2)}°S +/- ${lat.uncertainty?.toFixed(2)} km`
}

function prettyLongitude(lon: QRealQuantity) {
  return lon.value > 0
    ? `${lon.value.toFixed(2)}°E +/- ${lon.uncertainty?.toFixed(2)} km`
    : `${-lon.value.toFixed(2)}°W +/- ${lon.uncertainty?.toFixed(2)} km`
}

function prettyDepth(depth: QRealQuantity) {
  const uncertainty = depth.uncertainty != null ? `+- ${(depth.uncertainty / 1e3).toFixed(2)} km` : '(fixed)'
  return `${(depth.value / 1e3).toFixed(2)} km ${uncertainty}`
}

function rmsColor(o: QOrigin) {
  if (o.quality != null && o.quality.standardError != null) {
    return o.quality.standardError > 2
      ? 'text-red'
      : o.quality.standardError > 1
        ? 'text-orange'
        : ''
  }
  return ''
}

function azGapColor(o: QOrigin) {
  if (o.quality != null && o.quality.azimuthalGap != null) {
    return o.quality.azimuthalGap > 250
      ? 'text-red'
      : o.quality.azimuthalGap > 180
        ? 'text-orange'
        : ''
  }
  return ''
}

function minDistColor(o: QOrigin) {
  if (o.quality != null && o.quality.minimumDistance != null) {
    return o.quality.minimumDistance > 1
      ? 'text-red'
      : o.quality.minimumDistance > 0.5
        ? 'text-orange'
        : ''
  }
  return ''
}

function depthColor(o: QOrigin) {
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
          <v-list density="compact" v-if="props.origin != null" :bg-color="store.settings['color.surface']">
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