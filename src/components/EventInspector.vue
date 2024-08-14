<script setup lang="ts">
import type { QMagnitude, QOrigin, QRealQuantity } from '@/lib/sismojs/src/core/event/types'
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import type { ColObject } from '@/types'

const store = useAppStore()

const activeOrigin = ref(null as QOrigin | null)
const activeMagnitude = ref(null as QMagnitude | null)

const originCols = ref([
  {
    label: 'Creation Time',
    valueAccessor: (o: QOrigin) => o.creationInfo.creationTime,
    textAccessor: (o: QOrigin) => prettyTime(o.creationInfo.creationTime),
    enabled: true
  },
  {
    label: 'Author',
    valueAccessor: (o: QOrigin) => o.creationInfo.author,
    textAccessor: (o: QOrigin) => o.creationInfo.author,
    enabled: true
  },
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
    enabled: true
  },
  {
    label: 'Az. Gap',
    valueAccessor: (o: QOrigin) => o.quality?.azimuthalGap,
    textAccessor: (o: QOrigin) => `${o.quality?.azimuthalGap?.toFixed(0)} °`,
    enabled: true
  },
  {
    label: 'Min Dist',
    valueAccessor: (o: QOrigin) => o.quality?.minimumDistance,
    textAccessor: (o: QOrigin) => `${o.quality?.minimumDistance?.toFixed(2)} °`,
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
  }
] as ColObject[])

const magnitudeCols = ref([
  {
    label: 'Value',
    valueAccessor: (m: QMagnitude) => m.mag,
    textAccessor: (m: QMagnitude) => m.mag.value.toFixed(2),
    enabled: true
  },
  {
    label: 'Type',
    valueAccessor: (m: QMagnitude) => m.type,
    textAccessor: (m: QMagnitude) => m.type,
    enabled: true
  },
  {
    label: 'Nb Station',
    valueAccessor: (m: QMagnitude) => m.stationCount,
    textAccessor: (m: QMagnitude) => m.stationCount,
    enabled: true
  },
  {
    label: 'Method',
    valueAccessor: (m: QMagnitude) => m.methodID,
    textAccessor: (m: QMagnitude) => m.methodID,
    enabled: true
  }
] as ColObject[])

const magnitudes = computed(() => {
  if (store.currentEvent == null || store.currentEvent.preferredMagnitudeID == null || activeOrigin.value == null) {
    return []
  }
  return store.currentEvent.magnitude.filter(x => x.originID.id === activeOrigin.value!.publicID)
})

function setActiveOrigin(origin: QOrigin) {
  activeOrigin.value = origin
}

function setActiveMagnitude(magnitude: QMagnitude) {
  activeMagnitude.value = magnitude
}

function prettyTime(t: string) {
  return t.slice(0, 19).replace('T', ' ')
}

function prettyLatitude(lat: QRealQuantity) {
  return lat.value > 0
    ? `${lat.value.toFixed(2)}°N`
    : `${-lat.value.toFixed(2)}°S`
}

function prettyLongitude(lon: QRealQuantity) {
  return lon.value > 0
    ? `${lon.value.toFixed(2)}°E`
    : `${-lon.value.toFixed(2)}°W`
}

function prettyDepth(depth: QRealQuantity) {
  return `${(depth.value / 1e3).toFixed(2)} km`
}

function isOriginPreferred(o: QOrigin) {
  return store.currentEvent != null && store.currentEvent.preferredOriginID.id === o.publicID
}

function isOriginActive(o: QOrigin) {
  return activeOrigin.value != null && activeOrigin.value.publicID === o.publicID
}

function handleOriginColor(o: QOrigin) {
  return isOriginPreferred(o) ? store.settings['color.activeRowColor'] : ''
}

function handleOriginClass(o: QOrigin) {
  return isOriginActive(o) ? 'font-weight-bold' : ''
}

function isMagnitudePreferred(m: QMagnitude) {
  return store.currentEvent != null && store.currentEvent.preferredMagnitudeID.id === m.publicID
}

function isMagnitudeActive(m: QMagnitude) {
  return activeMagnitude.value != null && activeMagnitude.value.publicID === m.publicID
}

function handleMagnitudeClass(m: QMagnitude) {
  return isMagnitudeActive(m) ? 'font-weight-bold' : ''
}

function handleMagnitudeColor(m: QMagnitude) {
  return isMagnitudePreferred(m) ? store.settings['color.activeRowColor'] : ''
}

function setPreferredOrigin() {
  if (store.currentEvent != null && activeOrigin.value != null) {
    store.currentEvent.setPreferredOriginID(activeOrigin.value.publicID)
    if (
      store.currentEvent.preferredMagnitudeID.id != null
      && store.currentEvent.preferredMagnitudeID.referredObject.originID.id !== activeOrigin.value.publicID
    ) {
      store.currentEvent.setPreferredMagnitudeID(undefined)
    }
    store.setEvent(store.currentEvent)
  }
}

function setPreferredMagnitude() {
  if (
    store.currentEvent != null
    && activeMagnitude.value != null
    && store.currentEvent.preferredOriginID != null
    && activeMagnitude.value.originID.id === store.currentEvent.preferredOriginID.id
  ) {
    store.currentEvent.setPreferredMagnitudeID(activeMagnitude.value.publicID)
    store.setEvent(store.currentEvent)
  }
}

onMounted(() => {
  if (store.currentEvent != null) {
    setActiveOrigin(store.currentEvent.preferredOriginID.referredObject)
    setActiveMagnitude(store.currentEvent.preferredMagnitudeID.referredObject)
  }
})
</script>

<template>
  <v-row>
    <v-col cols="12">
      <EventOriginsMap @active-origin="setActiveOrigin" :active-origin="activeOrigin"/>
    </v-col>
  </v-row>
  <v-row>
    <v-col cols="8">
      <v-card>
        <v-card-title>Origins</v-card-title>
        <SmartTable
          v-if="store.currentEvent != null"
          sort-order="desc"
          :sort-col="0"
          :cols="originCols"
          :items="store.currentEvent.origin"
          :row-color="handleOriginColor"
          :row-class="handleOriginClass"
          @row-click="setActiveOrigin"
          store-key="originList"
        />
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="setPreferredOrigin" color="primary">Set preferred</v-btn>
        </v-card-actions>
      </v-card>
    </v-col>
    <v-col cols="4">
      <v-card>
        <v-card-title>Magnitudes</v-card-title>
        <SmartTable
          v-if="activeOrigin != null && store.currentEvent != null"
          sort-order="asc"
          :sort-col="2"
          :cols="magnitudeCols"
          :items="magnitudes"
          :row-class="handleMagnitudeClass"
          :row-color="handleMagnitudeColor"
          @row-click="setActiveMagnitude"
          store-key="magnitudeList"
        />
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="setPreferredMagnitude" color="primary">Set preferred</v-btn>
        </v-card-actions>
      </v-card>
    </v-col>
  </v-row>
</template>