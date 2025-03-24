<script setup lang="ts">
import { QResourceIdentifier, type QEvent, type QEventDescription, type QFocalMechanism, type QPick } from '@/lib/sismojs/src/core/event/types'
import { setLocalStorage, getLocalStorageDefault, toQuakeML } from '@/utils'
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { parse } from '@/lib/sismojs/src/core/event/quakeml'
import BeachballEngine from '@/lib/beachball'
import { useAppStore } from '@/stores/app'
import NumberField from './NumberField.vue'

const store = useAppStore()

const BOXSIZE = 292
const COLOR = '#888'
const HIRESTHRESH = 200

const BB_QUALITY_COLOR: Record<string, string> = {
  'A': 'lime',
  'B': 'green',
  'C': 'orange',
  'D': 'red'
}

const container = ref()

const initialized = ref(false)
const loading = ref(false)

const skhashParams = ref([
  { code: 'npolmin', value: 8, description: 'Minimum number of polarity data' },
  { code: 'nmc', value: 30, description: 'Number of trials' },
  { code: 'maxout', value: 100, description: 'Maximum number of focal mechanism outputted' },
  { code: 'badmin', value: 2.0, description: 'Minimum number of P-polarities per event assumed to be incorrect' },
  { code: 'max_agap', value: 200, description: 'Maximum azimuthal gap between stations in degrees' }
])

const defaultValue = [0, 90, 180]

const sdr = ref([defaultValue[0], defaultValue[1], defaultValue[2]])
const oldSdr = ref([sdr.value[0], sdr.value[1], sdr.value[2]])


const imagebbe = new BeachballEngine(50, 40, 1.5, '../static/wasm/beachball.wasm')
const bbe = ref(null as BeachballEngine | null)
const hiresbbe = ref(null as BeachballEngine | null)
let lastCall: number | null = null
let hirestimeout: number | null = null
let mouseDown = false
let mouseX: number | null = null
let mouseY: number | null = null

const stationCtx = ref(null as CanvasRenderingContext2D | null)
const stationPos = ref({} as {[netsta: string]: { pos: [number, number], pick: QPick } })
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
  if (store.eventManager.current.arrivals == null) {
    return []
  }
  return store.eventManager.current.arrivals.filter(a => {
    const p = a.pickID.referredObject
    return a.phase === 'P' && p.polarity != null
  })
})

const nbFM = ref(store.eventManager.current.event!.focalMechanism.length)

function deg2rad(a: number) {
  return a * Math.PI / 180
}

function handleReset() {
  if (bbe.value == null || hiresbbe.value == null) {
    return
  }
  const [oldS, oldD, oldR] = oldSdr.value
  sdr.value = [oldS, oldD, oldR]
  bbe.value.drawFocal(oldR, oldD, oldR, COLOR)
  hiresbbe.value.drawFocal(oldR, oldD, oldR, COLOR)
  store.eventManager.current.focalMechanism = null
}

function handleValidate() {
  const [s, d, r] = sdr.value
  store.eventManager.createFocalMechanism(s, d, r, polarizedArrivals.value.length)
  oldSdr.value = [s, d, r]
}

function handleStationPopup(e: MouseEvent) {
  const bbcr = stationCtx.value!.canvas.getBoundingClientRect()
  const x = e.clientX - bbcr.left
  const y = e.clientY - bbcr.top
  const content: string[] = []
  for (const [k, v] of Object.entries(stationPos.value)) {
    const dist = Math.sqrt(Math.pow(Math.abs(x - v.pos[0]), 2) + Math.pow(Math.abs(y - v.pos[1]), 2))
    if (dist < 5) {
      const text = [k]
      if (v.pick.polarity != null) {
        text.push(`| ${v.pick.polarity}`)
      }
      if (v.pick.onset != null) {
        text.push(`(${v.pick.onset})`)
      }
      content.push(text.join(' '))
    }
  }
  if (content.length > 0) {
    if (stationPopup != null) {
      stationPopup.remove()
    }
    stationPopup = document.createElement('div')
    Object.assign(stationPopup.style, {
      top: `${e.clientY + 5}px`,
      left: `${e.clientX + 5}px`
    }, stationPopupStyle)
    stationPopup.innerHTML = content.join('<br>')
    document.body.appendChild(stationPopup)
  }
}

function updateStationLayer(center: number, radius: number) {
  const ctx = stationCtx.value as CanvasRenderingContext2D
  ctx.save()
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  const result: {[netsta: string]: { pos: [number, number], pick: QPick } } = {}
  for (const a of store.eventManager.current.arrivals) {
    if (a.phase !== 'P' || a.takeoffAngle == null || a.azimuth == null) {
      continue
    }
    let azi = a.azimuth
    let beta = a.takeoffAngle
    // https://github.com/SeisComP/common/blob/6.4.4/libs/seiscomp/gui/datamodel/originlocatorview.cpp#L4248
    if (beta > 90) {
      beta = 180 - beta
      azi = azi - 180
      if (azi < 0) {
        azi == 360
      }
    }
    const dist = radius * Math.sqrt(2.0) * Math.sin(0.5 * deg2rad(beta))
    const xPos = center + dist * Math.sin(deg2rad(azi))
    const yPos = center - dist * Math.cos(deg2rad(azi))
    const pick: QPick = a.pickID.referredObject
    const netsta = pick.waveformID.netsta
    result[netsta] = { pos: [xPos, yPos], pick }
    if (pick.polarity == null) {
      ctx.beginPath()
      ctx.moveTo(xPos - 3, yPos - 3)
      ctx.lineTo(xPos + 3, yPos + 3)
      ctx.moveTo(xPos + 3, yPos - 3)
      ctx.lineTo(xPos - 3, yPos + 3)
      ctx.stroke()
    } else {
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
  }
  ctx.restore()
  stationPos.value = result
}

function updateBeachball() {
  if (bbe.value == null || hiresbbe.value == null) {
    return
  }
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
    e.stopPropagation()
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
        const dip = d + (-1 * deltaX * Math.cos(deg2rad(s)) + Math.sin(deg2rad(s)) * deltaY * -1) / 2
        let rake = r + (-1 * deltaY * Math.cos(deg2rad(s)) + Math.sin(deg2rad(s)) * deltaX) / 2
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
  Object.assign(container.value.style, {
    position: 'relative',
    width: '292px',
    height: '292px',
    marginLeft: 'auto',
    marginRight: 'auto'
  })
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

function loadStoredValues() {
  const stored = getLocalStorageDefault('skhashParams', {})
  for (const param of skhashParams.value) {
    if (stored[param.code] != null) {
      param.value = stored[param.code]
    }
  }
}

function storeParams() {
  const params: Record<string, number> = {}
  for (const param of skhashParams.value) {
    params[param.code] = param.value
  }
  setLocalStorage('skhashParams', params)
  return params
}

function init() {
  loading.value = true
  loadStoredValues()
  imagebbe.init()
  if (store.eventManager.current.focalMechanism != null) {
    const np = store.eventManager.current.focalMechanism.nodalPlanes.nodalPlane1
    const [s, d, r] = [np.strike.value, np.dip.value, np.rake.value]
    sdr.value = [s, d, r]
    oldSdr.value = [s, d, r]
  }
  const stationDistance: {[index: string]: number} = {}
  for (const a of store.eventManager.current.arrivals) {
    if (a.takeoffAngle == null && a.distance != null && a.phase === 'P') {
      const netsta = a.pickID.referredObject.waveformID.netsta
      stationDistance[netsta] = a.distance
    }
  }
  if (Object.keys(stationDistance).length > 0) {
    fetch('../api/takeoffangle', {
      method: 'POST',
      body: JSON.stringify({ depth: store.eventManager.current.origin!.depth.value / 1000, station: stationDistance }),
      headers: { 'Content-Type': 'application/json' }
    }).then(response => {
      if (response.status === 200) {
        response.json().then(toa => {
          for (const a of store.eventManager.current.arrivals) {
            if (a.phase === 'P') {
              const netsta = a.pickID.referredObject.waveformID.netsta
              a.takeoffAngle = toa[netsta]
            }
          }
          store.eventManager.current.arrivals = store.eventManager.current.arrivals.map(x => x)
          createBeachBall()
        })
      }
    })
  } else {
    createBeachBall()
  }
}

function handleCompute() {
  loading.value = true
  const params = storeParams()
  const picks = []
  const arrivals = []
  for (const arrival of store.eventManager.current.origin!.arrival) {
    const pick = arrival.pickID.referredObject
    if (arrival.takeoffAngle != null && arrival.azimuth != null && pick.polarity != null) {
      picks.push(pick.desc)
      arrivals.push(arrival.desc)
    }
  }
  const clonedOrigin = JSON.parse(JSON.stringify(store.eventManager.current.origin!.desc))
  clonedOrigin.arrival = arrivals
  const event: QEventDescription = {
    '@publicID': store.eventManager.current.event!.publicID,
    origin: [clonedOrigin],
    preferredOriginID: store.eventManager.current.origin!.publicID,
    magnitude: [store.eventManager.current.magnitude!.desc], stationMagnitude: [], amplitude: [],
    focalMechanism: [], pick: picks
  }
  for (const pick of event.pick) {
    if (pick.waveformID['@locationCode'] == null) {
      pick.waveformID['@locationCode'] = ''
    }
  }
  console.log(`[FirstMotion] POST: ${JSON.stringify([event])}`)
  const args = Object.entries(params).map(o => `${o[0]}=${o[1]}`).join('&')
  fetch(`../api/compute_focal_mechanisms?${args}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/xml'},
    body: toQuakeML(event)
  }).then(response => {
    loading.value = false
    store.notification.push({ type: 'progress', value: null })
    console.log(`[FirstMotion] response status: ${response.status}`)
    if (response.status === 200) {
      response.json().then(statusResponse => {
        console.log(`[FirstMotion] result: ${JSON.stringify(statusResponse)}`)
        if (statusResponse.message !== '') {
          alert(statusResponse.message)
        }
        if (statusResponse.quakeml !== '') {
          const doc = new DOMParser().parseFromString(statusResponse.quakeml, 'application/xml')
          const saveMainKey = QResourceIdentifier.mainKey
          QResourceIdentifier.mainKey = 'sandbox'
          const result = parse(doc) as QEvent[]
          QResourceIdentifier.mainKey = saveMainKey
          store.eventManager.current.event!.clearFocalMechanism()
          for (const fm of result[0].focalMechanism) {
            store.eventManager.current.event!.addFocalMechanism(fm.desc)
          }
          nbFM.value = store.eventManager.current.event!.focalMechanism.length
        }
      })
    }
  })
}

function getFMQuality(fm: QFocalMechanism) {
  if (fm.comment != null && fm.comment.length > 0) {
    try {
      const comment = JSON.parse(fm.comment[0].text)
      return comment.quality || ''
    } catch {
      return ''
    }
  }
  return ''
}

function getFMImage(fm: QFocalMechanism) {
  let color = BB_QUALITY_COLOR[getFMQuality(fm)] || 'black'
  const np = fm.nodalPlanes.nodalPlane1
  return imagebbe.getFocalImage(np.strike.value, np.dip.value, np.rake.value, color)
}

function setFM(fm: QFocalMechanism) {
  const np = fm.nodalPlanes.nodalPlane1
  sdr.value = oldSdr.value = [np.strike.value, np.dip.value, np.rake.value]
  store.eventManager.current.focalMechanism = fm
  store.eventManager.current.event!.setPreferredFocalMechanismID(fm.publicID)
  store.eventManager.status.commit = 'required'
  updateBeachball()
}

watch([
  () => sdr.value[0],
  () => sdr.value[1],
  () => sdr.value[2]
], () => {
  updateBeachball()
})

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
    <v-col class="first-motion__container pa-0">
      <div ref="container"></div>
    </v-col>
    <v-col class="text-right" cols="3">
      <v-progress-circular v-if="loading" indeterminate="disable-shrink" size="20" class="ml-4"/>
      <table class="first-motion__table">
        <tbody>
          <tr>
            <th>strike</th>
            <td><NumberField v-model="sdr[0]" hide-details density="compact"/></td>
          </tr>
          <tr>
            <th>dip</th>
            <td><NumberField v-model="sdr[1]" hide-details density="compact"/></td>
          </tr>
          <tr>
            <th>rake</th>
            <td><NumberField v-model="sdr[2]" hide-details density="compact"/></td>
          </tr>
        </tbody>
      </table>
      <v-menu location="start" :close-on-content-click="false" v-if="store.config?.skhash.enabled" min-width="200">
        <template #activator="{ props }">
          <v-btn v-bind="props" density="compact" variant="text" icon="mdi-dots-horizontal"></v-btn>
        </template>
        <v-card>
          <v-table>
            <tbody>
              <tr v-for="param in skhashParams">
                <th :title="param.description">{{ param.code }}</th>
                <td><NumberField v-model="param.value" density="compact" hide-details/></td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-menu>
      <v-btn
        v-if="store.config?.skhash.enabled"
        density="compact"
        @click="handleCompute"
        :disabled="!initialized || loading || store.eventManager.current.magnitude == null"
        class="ma-1">COMPUTE</v-btn>
      <br>
      <v-dialog max-width="700" v-if="store.config?.skhash.enabled">
        <template #activator="{ props: activatorProps }">
          <v-badge :content="nbFM">
            <v-btn v-bind="activatorProps" density="compact" class="ma-1">BROWSE</v-btn>
          </v-badge>
        </template>
        <template #default="{ isActive }">
          <v-card>
            <v-table>
              <thead>
                <tr>
                  <th></th>
                  <th>Quality</th>
                  <th>Strike</th>
                  <th>Dip</th>
                  <th>Rake</th>
                  <th>Nb Pol.</th>
                  <th>Misfit</th>
                  <th>Method</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="fm in store.eventManager.current.event!.focalMechanism">
                  <td><img :src="getFMImage(fm)"></td>
                  <td>{{ getFMQuality(fm) }}</td>
                  <td>{{ fm.nodalPlanes.nodalPlane1.strike.value.toFixed(2) }}</td>
                  <td>{{ fm.nodalPlanes.nodalPlane1.dip.value.toFixed(2) }}</td>
                  <td>{{ fm.nodalPlanes.nodalPlane1.rake.value.toFixed(2) }}</td>
                  <td>{{ fm.stationPolarityCount }}</td>
                  <td>{{ fm.misfit }}</td>
                  <td>{{ fm.methodID }}</td>
                  <td><v-btn density="compact" @click="setFM(fm)">set</v-btn></td>
                </tr>
              </tbody>
            </v-table>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn @click="isActive.value = false">Close</v-btn>
            </v-card-actions>
          </v-card>
        </template>
      </v-dialog><br>
      <v-btn
        density="compact"
        @click="handleValidate"
        :color="isDirty ? 'orange' : 'white'"
        :disabled="!isDirty"
        class="ma-1">VALIDATE</v-btn><br>
      <v-btn density="compact" @click="handleReset" class="ma-1">RESET</v-btn>
    </v-col>
  </v-row>
</template>
  
<style>
  /* .first-motion__container {
    position: relative;
    height: 292px;
  } */
  .first-motion__container canvas {
    position: absolute;
    top: 0;
    left: 0;
    /* right: 0; */
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