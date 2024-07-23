<script setup lang="ts">
import { type ScatterOptions } from '@/lib/lichen/src/types'
import { Magnitude, Origin } from '@/lib/sismojs/src/core/event/types'
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import Lichen from '@/lib/lichen/src'

const store = useAppStore()

const magScatter = ref()
const gutenbergRichter = ref()
const magScatterChart = ref(null as Lichen | null)
const gutenbergRichterChart = ref(null as Lichen | null)

function drawMagScatter() {
  if (magScatterChart.value != null) {
    magScatterChart.value.destroy()
  }
  const data: ScatterOptions['data'] = []
  for (const event of store.cacheEventList) {
    if (event.preferredMagnitudeID.id == null) {
      continue
    }
    const po = event.preferredOriginID.referredObject as Origin
    const pm = event.preferredMagnitudeID.referredObject as Magnitude
    data.push({ name: event.publicID, x: po.time.object.getTime(), y: pm.mag.value })
  }
  const serie: ScatterOptions = { name: '', shape: 'circle', enabled: true, color: 'blue', data }
  magScatterChart.value = new Lichen(magScatter.value, {
    header: { position: 'top', title: 'Temporal distribution' },
    legend: { enabled: false },
    height: 300,
    type: 'scatter',
    series: [serie]
  })
}

function drawGutenbergRichter() {
  console.log(store.cacheEventList)
  const allMags = [...new Set(
    store.cacheEventList
      .filter(e => e.preferredMagnitudeID.id != null)
      .map(e => e.preferredMagnitudeID.referredObject.mag.value)
  )]
  allMags.sort()
  console.log(allMags)
  const data: ScatterOptions['data'] = []
  for (const mag of allMags) {
    data.push({ x: mag, y: allMags.filter(m => m >= mag).length, name: '' })
  }
  console.log(data)
  const serie: ScatterOptions = { name: '', shape: 'circle', enabled: true, color: 'blue', data }
  gutenbergRichterChart.value = new Lichen(gutenbergRichter.value, {
    header: { position: 'top', title: 'Temporal distribution' },
    legend: { enabled: false },
    yAxis: { logarithmic: true, min: 1, max: data[0].y * 2 },
    height: 300,
    xAxis: { datetime: false },
    type: 'scatter',
    series: [serie],
    hooks: {
      beforeUpdate: (chart) => {
        const dataUtils = chart.master.getRegistered('DATA_UTILS')
        dataUtils.yMin = Math.max(1, dataUtils.yMin)
        return true
      }
    }
  })
}

onMounted(() => {
  if (store.cacheEventList.length > 1) {
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