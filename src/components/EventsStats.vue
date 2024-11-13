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
const magCompl = ref(null as number | null)

const filteredEventList = computed(() => {
  if (props.hideDiscarded === true) {
    return store.eventManager.events.filter((e) => {
      const eventType = e.type || ''
      const poStatus = e.preferredOriginID.referredObject.evaluationStatus || ''
      if (DISCARDED_EVENT_TYPES.indexOf(eventType) >= 0 || poStatus === 'rejected') {
        return false
      }
      return true
    })
  }
  return store.eventManager.events
})

const cumulativeMagsCount = computed(() => {
  const allMags = filteredEventList.value
    .filter(e => e.preferredMagnitudeID.id != null)
    .map(e => e.preferredMagnitudeID.referredObject.mag.value)
  allMags.sort()
  const data: ScatterOptions['data'] = []
  for (const mag of allMags) {
    data.push({ x: mag, y: allMags.filter(m => m >= mag).length, name: '' })
  }
  return data
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

function linearRegression(data: { x: number; y:number }[]) {
  const csv = ['x,y']
  let sumX = 0
  let sumY = 0
  for (const point of data) {
    sumX += point.x
    sumY += point.y
    csv.push(`${point.x},${point.y}`)
  }
  const avgX = sumX / data.length
  const avgY = sumY / data.length
  let tauXY = 0
  let tauX = 0
  for (const point of data) {
    tauXY += point.x * point.y - avgX * avgY
    tauX += point.x * point.x - avgX * avgX
  }
  tauX = Math.sqrt(tauX / data.length)
  tauXY = tauXY / data.length

  const b = tauXY / (tauX * tauX)
  const a = avgY - b * avgX
  // console.log(csv.join('\n'))
  return { a, b }
}

function bValueLikelihoodMaximization(mags: number[]) {
  // mags is all magnitudes that are superior to the magnitude of completude
  let magSum = 0
  let minMag = null
  for (const mag of mags) {
    magSum += mag
    minMag = minMag == null ? mag : Math.min(mag, minMag)
  }
  const avgMag = magSum / mags.length
  const b = Math.log10(Math.exp(1)) / (avgMag - minMag!)
  const sigma = b * (1.96 / Math.sqrt(mags.length))
  return { b, sigma }
}

function setAutomaticMagnitudeOfCompletude() {
  const data = cumulativeMagsCount.value
  let regrData = data.filter(point => point.y >= 5).map(point => ({ x: point.x, y: Math.log10(point.y) }))
  let delta = 1
  let i = 0
  let ab = null
  for (; delta > 0.1 && i < regrData.length - 10; i++) {
    ab = linearRegression(regrData.slice(i))
    delta = Math.abs(ab.b * regrData[0].x + ab.a - regrData[0].y)
    console.log({i, ab, delta, m: regrData[i].x})
  }
  if (ab != null) {
    magCompl.value = regrData[i - 1].x
    console.log({ mc: magCompl.value, a: ab.a, b: ab.b })
  }
  // console.log(ab)
  // let delta = Math.abs(ab.b * regrData[0].x + ab.a - regrData[0].y)
  // console.log(delta)
  // while(delta > 0.1) {
  //   regrData = regrData.slice(1)
  //   ab = linearRegression(regrData)
  //   console.log(ab)
  //   delta = Math.abs(ab.b * regrData[0].x + ab.a - regrData[0].y)
  //   console.log(delta)
  // }
  // console.log(regrData[0].x)
  // console.log(`0,${ab.a}`)
  // console.log(`${data.slice(-1)[0].x},${data.slice(-1)[0].x * ab.b + ab.a}`)
  console.log(bValueLikelihoodMaximization(regrData.slice(i - 1).map(point => point.x)))
}

function drawGutenbergRichter() {
  if (gutenbergRichterChart.value != null) {
    gutenbergRichterChart.value.destroy()
  }
  const data = cumulativeMagsCount.value
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
    // setAutomaticMagnitudeOfCompletude()
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