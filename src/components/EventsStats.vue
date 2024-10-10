<script setup lang="ts">
import { type ScatterOptions } from '@/lib/lichen/src/types'
import { QMagnitude, QOrigin } from '@/lib/sismojs/src/core/event/types'
import { DISCARDED_EVENT_TYPES } from '@/utils'
import { ref, onMounted, computed, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import Lichen from '@/lib/lichen/src'

const props = defineProps<{
  hideDiscarded: boolean
}>()

const store = useAppStore()

const magScatter = ref()
const gutenbergRichter = ref()
const magScatterChart = ref(null as Lichen | null)
const gutenbergRichterChart = ref(null as Lichen | null)

const filteredEventList = computed(() => {
  if (props.hideDiscarded === true) {
    return store.cacheEventList.filter((e) => {
      const eventType = e.type || ''
      const poStatus = e.preferredOriginID.referredObject.evaluationStatus || ''
      if (DISCARDED_EVENT_TYPES.indexOf(eventType) >= 0 || poStatus === 'rejected') {
        return false
      }
      return true
    })
  }
  return store.cacheEventList
})

function drawMagScatter() {
  if (magScatterChart.value != null) {
    magScatterChart.value.destroy()
  }
  const data: ScatterOptions['data'] = []
  for (const event of filteredEventList.value) {
    if (event.preferredMagnitudeID.id == null) {
      continue
    }
    const po = event.preferredOriginID.referredObject as QOrigin
    const pm = event.preferredMagnitudeID.referredObject as QMagnitude
    data.push({ name: event.publicID, x: po.time.object.getTime(), y: pm.mag.value })
  }
  const serie: ScatterOptions = { name: '', shape: 'circle', enabled: true, color: 'blue', data }
  const fontSize = store.settings['picker.tickFontSize']
  magScatterChart.value = new Lichen(magScatter.value, {
    header: { position: 'top', title: 'Temporal distribution' },
    xAxis: { fontSize }, yAxis: { fontSize },
    legend: { enabled: false },
    height: 300,
    type: 'scatter',
    series: [serie]
  })
}

function drawGutenbergRichter() {
  if (gutenbergRichterChart.value != null) {
    gutenbergRichterChart.value.destroy()
  }
  const allMags = [...new Set(
    filteredEventList.value
      .filter(e => e.preferredMagnitudeID.id != null)
      .map(e => e.preferredMagnitudeID.referredObject.mag.value)
  )]
  allMags.sort()
  const data: ScatterOptions['data'] = []
  for (const mag of allMags) {
    data.push({ x: mag, y: allMags.filter(m => m >= mag).length, name: '' })
  }
  const serie: ScatterOptions = { name: '', shape: 'circle', enabled: true, color: 'blue', data }
  const fontSize = store.settings['picker.tickFontSize']
  gutenbergRichterChart.value = new Lichen(gutenbergRichter.value, {
    header: { position: 'top', title: 'Gutenberg-Richter' },
    legend: { enabled: false },
    xAxis: { datetime: false, fontSize },
    yAxis: { logarithmic: true, min: 1, max: data[0].y * 2, fontSize },
    height: 300,
    type: 'scatter',
    series: [serie],
    hooks: {
      beforeDraw: (chart) => {
        const dataUtils = chart.master.getRegistered('DATA_UTILS')
        dataUtils.yMin = Math.max(1, dataUtils.yMin)
        return true
      }
    }
  })
}

watch(() => filteredEventList.value, () => {
  if (filteredEventList.value.length > 1) {
    drawMagScatter()
    drawGutenbergRichter()
  }
})

onMounted(() => {
  if (filteredEventList.value.length > 1) {
    drawMagScatter()
    drawGutenbergRichter()
  }
})
</script>

<template>
  <v-card>
    <v-row>
      <v-col cols="8">
        <div ref="magScatter"></div>
      </v-col>
      <v-col cols="4">
        <div ref="gutenbergRichter"></div>
      </v-col>
    </v-row>
  </v-card>
</template>