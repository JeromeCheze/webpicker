<script setup lang="ts">
import BeachballEngine from '@/lib/beachball'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useAppStore } from '@/stores/app'
import type { Pick } from '@/lib/sismojs/src/core/event/types';

const store = useAppStore()

const BOXSIZE = 292
const COLOR = '#888'
const HIRESTHRESH = 200

const container = ref()

const initialized = ref(false)
const loading = ref(false)

const defaultValue = [0, 90, 180]

const sdr = ref([defaultValue[0], defaultValue[1], defaultValue[2]])
const oldSdr = ref([sdr.value[0], sdr.value[1], sdr.value[2]])

const bbe = ref(null as BeachballEngine | null)
const hiresbbe = ref(null as BeachballEngine | null)
let lastCall: number | null = null
let hirestimeout: number | null = null
let mouseDown = false
let mouseX: number | null = null
let mouseY: number | null = null

const stationCtx = ref(null as CanvasRenderingContext2D | null)
const stationPos = ref({} as {[netsta: string]: { pos: [number, number], pick: Pick } })
let stationPopup: HTMLElement | null = null
const stationPopupStyle = {
  position: 'absolute',
  background: '#fff',
  padding: '3px 5px',
  color: '#000',
  fontSize: '12px',
  borderRadius: '4px',
  border: '1px solid #000'
}

const isDirty = computed(() => {
  const [s, d, r] = sdr.value
  const [oldS, oldD, oldR] = oldSdr.value
  return s !== oldS || d !== oldD || r !== oldR
})

const polarizedArrivals = computed(() => {
  if (store.currentArrivals == null) {
    return []
  }
  return store.currentArrivals.filter(a => {
    const p = a.pickID.referredObject
    return a.phase === 'P' && p.polarity != null
  })
})

function handleReset() {
  if (bbe.value == null || hiresbbe.value == null) {
    return
  }
  const [oldS, oldD, oldR] = oldSdr.value
  sdr.value = [oldS, oldD, oldR]
  bbe.value.drawFocal(oldR, oldD, oldR, COLOR)
  hiresbbe.value.drawFocal(oldR, oldD, oldR, COLOR)
  store.currentFocalMechanism = null
}

function handleValidate() {
  const [s, d, r] = sdr.value
  store.createFocalMechanism(s, d, r, polarizedArrivals.value.length)
  oldSdr.value = [s, d, r]
}

function handleStationPopup(e: MouseEvent) {
  const bbcr = stationCtx.value!.canvas.getBoundingClientRect()
  const x = e.clientX - bbcr.left
  const y = e.clientY - bbcr.top
  for (const [k, v] of Object.entries(stationPos.value)) {
    const dist = Math.sqrt(Math.pow(Math.abs(x - v.pos[0]), 2) + Math.pow(Math.abs(y - v.pos[1]), 2))
    if (dist < 5) {
      if (stationPopup != null) {
        stationPopup.remove()
      }
      stationPopup = document.createElement('div')
      Object.assign(stationPopup.style, {
        top: `${e.clientY + 5}px`,
        left: `${e.clientX + 5}px`
      }, stationPopupStyle)
      const text = [k, `| ${v.pick.polarity}`]
      if (v.pick.onset != null) {
        text.push(`(${v.pick.onset})`)
      }
      stationPopup.innerHTML = text.join(' ')
      document.body.appendChild(stationPopup)
    }
  }
}

function updateStationLayer(center: number, radius: number) {
  const ctx = stationCtx.value as CanvasRenderingContext2D
  ctx.save()
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  const result: {[netsta: string]: { pos: [number, number], pick: Pick } } = {}
  for (const a of polarizedArrivals.value) {
    if (a.takeoffAngle == null || a.azimuth == null) {
      continue
    }
    const dist = radius * (a.takeoffAngle > 90 ? 180 - a.takeoffAngle : a.takeoffAngle) / 90
    const xPos = center - dist * Math.cos(Math.PI * (a.azimuth - 90) / 180)
    const yPos = center - dist * Math.sin(Math.PI * (a.azimuth - 90) / 180)
    const pick: Pick = a.pickID.referredObject
    const netsta = pick.waveformID.netsta
    result[netsta] = { pos: [xPos, yPos], pick }
    ctx.beginPath()
    const r = pick.onset === 'impulsive' ? 5 : pick.onset === 'emergent' ? 3 : 4
    ctx.setLineDash(pick.polarity === 'undecidable' ? [2, 2] : [])
    ctx.lineWidth = pick.polarity === 'undecidable' ? 2 : 1
    ctx.arc(xPos, yPos, r, 0, 2 * Math.PI)
    if (pick.polarity === 'positive') {
      ctx.fill()
    } else {
      ctx.stroke()
    }
  }
  ctx.restore()
  stationPos.value = result
}

function updateBeachball() {
  const t = new Date().getTime()
  const [s, d, r] = sdr.value
  if (lastCall == null || (t - lastCall) > 30) {
    if (hirestimeout != null) {
      clearTimeout(hirestimeout)
    }
    hirestimeout = window.setTimeout(() => {
      hiresbbe.value!.drawFocal(s, d, r, COLOR)
      hiresbbe.value!.ctx!.canvas.style.zIndex = '1'
      updateStationLayer(bbe.value!.center, bbe.value!.radius as number)
    }, HIRESTHRESH)
    // console.log(t - lastCall);
    lastCall = t
    requestAnimationFrame(() => {
      // value.innerHTML = `strike: ${s} | dip: ${d} | rake: ${r}`
      bbe.value!.drawFocal(s, d, r, COLOR)
      hiresbbe.value!.ctx!.canvas.style.zIndex = '-1'
    })
  }
}

function bindEvents() {
  container.value.addEventListener('mousedown', (e: MouseEvent) => {
    mouseDown = true
    mouseX = e.clientX
    mouseY = e.clientY
  })
  container.value.addEventListener('mouseup', () => {
    mouseDown = false
    mouseX = mouseY = null
  })
  container.value.addEventListener('mousemove', (e: MouseEvent) => {
    if (stationPopup != null) {
      stationPopup.remove()
      stationPopup = null
    }
    if (mouseDown === false) {
      handleStationPopup(e)
      return
    }
    if (mouseX == null || mouseY == null) {
      return
    }
    e.preventDefault()
    const deltaX = e.clientX - mouseX
    const deltaY = e.clientY - mouseY
    const [s, d, r] = sdr.value
    if (e.shiftKey) {
      if (Math.abs(deltaX) > 0) {
        let strike = s + deltaX
        sdr.value[0] = strike < 0 ? strike + 360 : strike > 360 ? strike - 360 : strike
        mouseX = e.clientX
      }
    } else {
      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        const dip = d + (-1 * deltaX * Math.cos(s * Math.PI / 180) + Math.sin(s * Math.PI / 180) * deltaY * -1) / 2
        let rake = r + (-1 * deltaY * Math.cos(s * Math.PI / 180) + Math.sin(s * Math.PI / 180) * deltaX) / 2
        if (dip > 90) {
          sdr.value[0] = s < 180 ? s + 180 : s - 180
          rake = rake * -1
        } else if (dip < 0) {
          sdr.value[0] = s < 180 ? s + 180 : s - 180
          rake = rake + 180
        }
        sdr.value[1] = dip < 0 ? 0 - dip : dip > 90 ? 180 - dip : dip
        sdr.value[2] = rake > 180 ? rake - 360 : rake < -180 ? rake + 360 : rake
        mouseX = e.clientX
        mouseY = e.clientY
      }
    }
    updateBeachball()
  })
}

function createBeachBall() {
  if (container.value == null) {
    return
  }
  bbe.value = new BeachballEngine(BOXSIZE, 50, 3, '../static/wasm/beachball.wasm')
  hiresbbe.value = new BeachballEngine(BOXSIZE, 120, 1.1, '../static/wasm/beachball.wasm')
  const stationCanvas = document.createElement('canvas')
  stationCanvas.width = stationCanvas.height = BOXSIZE
  Object.assign(stationCanvas.style, { zIndex: '2' })
  container.value.appendChild(stationCanvas)
  stationCtx.value = stationCanvas.getContext('2d')
  hiresbbe.value.init().then(() => {
    const hirescanvas = hiresbbe.value!.ctx!.canvas
    hirescanvas.style.zIndex = '1'
    container.value.appendChild(hirescanvas)
    bbe.value!.init().then(() => {
      bbe.value!.ctx!.canvas.style.zIndex = '0'
      container.value.appendChild(bbe.value!.ctx!.canvas)
      updateBeachball()
      bindEvents()
      initialized.value = true
      loading.value = false
    })
  })
}

function init() {
  loading.value = true
  if (store.currentFocalMechanism != null) {
    const np = store.currentFocalMechanism.nodalPlanes.nodalPlane1
    const [s, d, r] = [np.strike.value, np.dip.value, np.rake.value]
    sdr.value = [s, d, r]
    oldSdr.value = [s, d, r]
  }
  const stationDistance: {[index: string]: number} = {}
  for (const a of polarizedArrivals.value) {
    if (a.distance != null) {
      const netsta = a.pickID.referredObject.waveformID.netsta
      stationDistance[netsta] = a.distance
    }
  }
  fetch('../api/takeoffangle', {
    method: 'POST',
    body: JSON.stringify({ depth: store.currentOrigin!.depth.value / 1000, station: stationDistance }),
    headers: { 'Content-Type': 'application/json' }
  }).then(response => {
    if (response.status === 200) {
      response.json().then(toa => {
        for (const a of polarizedArrivals.value) {
          const netsta = a.pickID.referredObject.waveformID.netsta
          a.takeoffAngle = toa[netsta]
        }
        createBeachBall()
      })
    }
  })
}

onMounted(() => {
  init()
})

onBeforeUnmount(() => {
  if (stationPopup != null) {
    stationPopup.remove()
    stationPopup = null
  }
})
</script>

<template>
  <v-row row wrap class="pa-4">
    <v-col class="first-motion__container">
      <div ref="container"></div>
    </v-col>
    <v-col class="text-right" cols="5">
      <v-progress-circular v-if="loading" indeterminate="disable-shrink" size="20" class="ml-4"/>
      <table class="first-motion__table">
        <tbody>
          <tr>
            <th>strike</th>
            <td>{{ sdr[0].toFixed() }}</td>
          </tr>
          <tr>
            <th>dip</th>
            <td>{{ sdr[1].toFixed() }}</td>
          </tr>
          <tr>
            <th>rake</th>
            <td>{{ sdr[2].toFixed() }}</td>
          </tr>
        </tbody>
      </table>
      <v-btn
        density="compact"
        @click="handleValidate"
        :color="isDirty ? 'orange' : 'white'"
        light
        class="ma-1"
      >VALIDATE</v-btn><br>
      <v-btn density="compact" @click="handleReset" class="ma-1">RESET</v-btn>
    </v-col>
  </v-row>
</template>
  
<style>
  .first-motion__container {
    position: relative;
    height: 292px;
  }
  .first-motion__container canvas {
    position: absolute;
    top: 0;
    right: 0;
  }
  .first-motion__table {
    width: 100%;
  }
  .first-motion__table th,
  .first-motion__table td {
    padding: 0 5px;
    text-align: right;
  }
</style>