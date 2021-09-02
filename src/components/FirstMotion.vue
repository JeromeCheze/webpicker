<template>
  <v-layout row wrap>
    <v-flex class="first-motion__container"></v-flex>
    <v-flex class="text-xs-right" xs2>
      <table class="first-motion__table">
        <tbody>
          <tr>
            <th>strike</th>
            <td>{{ strike.toFixed() }}</td>
          </tr>
          <tr>
            <th>dip</th>
            <td>{{ dip.toFixed() }}</td>
          </tr>
          <tr>
            <th>rake</th>
            <td>{{ rake.toFixed() }}</td>
          </tr>
        </tbody>
      </table>
      <v-btn
        small
        @click="handleValidate"
        :color="isDirty ? 'orange' : 'white'"
        light
      >VALIDATE</v-btn><br>
      <v-btn small @click="handleReset">RESET</v-btn>
      <v-btn
        small
        @click="handleDelete"
        v-if="focalMechanism != null && focalMechanism.nodal_planes != null"
      >DELETE</v-btn>
    </v-flex>
  </v-layout>
</template>

<script>
import * as utils from '@/utils/utils'
import BeachballEngine from '@/lib/beachball'

const BOXSIZE = 340
const SIZE = 3
const NBPOINT = 50
const COLOR = '#888'

export default {
  props: ['active'],
  data () {
    let [strike, dip, rake] = [0, 90, 180]
    return {
      initialized: false,
      oldStrike: strike,
      oldDip: dip,
      oldRake: rake,
      strike,
      dip,
      rake,
      stationLayerInitialized: false,
      bbe: null,
      hiresbbe: null,
      stationCtx: null,
      popupCtx: null,
      stationPos: {}
    }
  },
  computed: {
    event () {
      return this.$store.state.currentEvent
    },
    origin () {
      return this.$store.state.currentOrigin
    },
    focalMechanism () {
      return this.$store.state.currentFocalMechanism
    },
    inventory () {
      return this.$store.state.inventory
    },
    polarizedArrivals () {
      return this.origin.arrival.filter(a => a.phase === 'P' && a._pick.polarity != null)
    },
    isDirty () {
      return this.strike != this.oldStrike || this.dip != this.oldDip || this.rake != this.oldRake
    }
  },
  watch: {
    active: function (newValue) {
      if (newValue === true && this.initialized === false) {
        this.init()
      }
    }
  },
  methods: {
    handleReset () {
      let [s, d, r] = [this.oldStrike, this.oldDip, this.oldRake]
      this.strike = s
      this.dip = d
      this.rake = r
      this.bbe.drawFocal(s, d, r, COLOR)
      this.hiresbbe.drawFocal(s, d, r, COLOR)
    },
    handleValidate () {
      let fmObject = {
        public_id: this.$store.getters.getId('FocalMechanism'),
        evaluation_mode: 'manual',
        nodal_planes: {
          nodal_plane1: {
            strike: { value: this.strike },
            dip: { value: this.dip },
            rake: { value: this.rake }
          }
        },
        _not_committed: true
      }
      this.oldStrike = this.strike
      this.oldDip = this.dip
      this.oldRake = this.rake
      this.event.focal_mechanism = [fmObject]
      this.event.preferred_focal_mechanism_id = fmObject.public_id
      this.$store.dispatch('setCurrentFocalMechanism', fmObject)
    },
    handleDelete () {
      let [s, d, r] = [0, 90, 180]
      this.oldStrike = this.strike = s
      this.oldDip = this.dip = d
      this.oldRake = this.rake = r
      this.bbe.drawFocal(s, d, r, COLOR)
      this.hiresbbe.drawFocal(s, d, r, COLOR)
      this.$store.dispatch('setCurrentFocalMechanism', { _not_committed: true })
      this.event.focal_mechanism = []
    },
    handleStationPopup (x, y) {
      let ctx = this.popupCtx
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      for (let [k, v] of Object.entries(this.stationPos)) {
        let dist = Math.sqrt(Math.pow(Math.abs(x - v[0]), 2) + Math.pow(Math.abs(y - v[1]), 2))
        if (dist < 5) {
          const t = ctx.measureText(k)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
          let xPos = v[0] > this.hiresbbe.center ? v[0] - t.width - 5 : v[0] + 5
          ctx.fillRect(xPos, v[1] - 12 - 7, t.width + 4, 12 + 4)
          ctx.fillStyle = 'black'
          ctx.fillText(k, xPos, v[1] - 5)
        }
      }
    },
    createBeachBall () {
      const bbe = new BeachballEngine(BOXSIZE, NBPOINT, SIZE, this.$store.getters.getLink('static/wasm/beachball.wasm'))
      const hiresbbe = new BeachballEngine(BOXSIZE, 120, 1.1, this.$store.getters.getLink('static/wasm/beachball.wasm'))
      const container = document.querySelector('.first-motion__container')

      const stationCanvas = document.createElement('canvas')
      stationCanvas.style.zIndex = 2
      stationCanvas.width = stationCanvas.height = BOXSIZE
      container.appendChild(stationCanvas)
      this.stationCtx = stationCanvas.getContext('2d')

      const popupCanvas = document.createElement('canvas')
      popupCanvas.style.zIndex = 3
      popupCanvas.width = popupCanvas.height = BOXSIZE
      container.appendChild(popupCanvas)
      this.popupCtx = popupCanvas.getContext('2d')
      this.popupCtx.font = '12px sans-serif'
      this.popupCtx.textBaseline = 'bottom'

      this.bbe = bbe
      this.hiresbbe = hiresbbe

      let lastCall = null
      let hirestimeout = null
      let mouseDown = false
      const HIRESTHRESH = 200
      const updateBeachball = () => {
        let t = new Date().getTime()
        let s = this.strike
        let d = this.dip
        let r = this.rake
        if (lastCall == null || (t - lastCall) > 30) {
          if (hirestimeout != null) {
            clearTimeout(hirestimeout)
          }
          hirestimeout = setTimeout(() => {
            hiresbbe.drawFocal(s, d, r, COLOR)
            hiresbbe.ctx.canvas.style.zIndex = 1
          }, HIRESTHRESH)
          // console.log(t - lastCall);
          lastCall = t
          requestAnimationFrame(() => {
            // value.innerHTML = `strike: ${s} | dip: ${d} | rake: ${r}`
            bbe.drawFocal(s, d, r, COLOR)
            hiresbbe.ctx.canvas.style.zIndex = -1
          })
        }
      }

      let mouseX = null
      let mouseY = null
      hiresbbe.init().then(() => {
        let hirescanvas = hiresbbe.ctx.canvas
        Object.assign(hirescanvas.style, { zIndex: 1 })
        container.appendChild(hirescanvas)
        bbe.init().then(() => {
          Object.assign(bbe.ctx.canvas.style, { zIndex: 0 })
          container.appendChild(bbe.ctx.canvas)
          updateBeachball()
          container.addEventListener('mousedown', ev => {
            mouseDown = true
            mouseX = ev.clientX
            mouseY = ev.clientY
          })
          container.addEventListener('mouseup', () => {
            mouseDown = false
            mouseX = mouseY = null
          })
          container.addEventListener('mousemove', ev => {
            const bbcr = this.stationCtx.canvas.getBoundingClientRect()
            let absX = ev.clientX - bbcr.left
            let absY = ev.clientY - bbcr.top
            this.handleStationPopup(absX, absY)
            if (mouseDown == false) {
              return
            }
            ev.preventDefault()
            let deltaX = ev.clientX - mouseX
            let deltaY = ev.clientY - mouseY
            let s = this.strike
            if (ev.shiftKey) {
              if (Math.abs(deltaX) > 0) {
                let newStrikeValue = s + deltaX
                this.strike = newStrikeValue < 0 ? newStrikeValue + 360 : newStrikeValue > 360 ? newStrikeValue - 360 : newStrikeValue
                mouseX = ev.clientX
              }
            } else {
              let d = this.dip
              let r = this.rake
              // console.log(deltaX, deltaY);
              if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
                let newDipValue = d + (-1 * deltaX * Math.cos(s * Math.PI / 180) + Math.sin(s * Math.PI / 180) * deltaY * -1) / 2
                let newRakeValue = r + (-1* deltaY * Math.cos(s * Math.PI / 180) + Math.sin(s * Math.PI / 180) * deltaX) / 2
                if (newDipValue > 90) {
                  this.strike = s < 180 ? s + 180 : s - 180
                  newRakeValue = newRakeValue * -1
                } else if (newDipValue < 0 ) {
                  this.strike = s < 180 ? s + 180 : s - 180
                  newRakeValue = newRakeValue + 180
                }
                this.dip = newDipValue < 0 ? 0 - newDipValue : newDipValue > 90 ? 180 - newDipValue : newDipValue
                this.rake = newRakeValue > 180 ? newRakeValue - 360 : newRakeValue < -180 ? newRakeValue + 360 : newRakeValue
                mouseX = ev.clientX
                mouseY = ev.clientY
              }
            }
            updateBeachball()
          })
        })
      })
      setTimeout(() => {
        this.updateStationLayer(hiresbbe.center, hiresbbe.radius)
      }, HIRESTHRESH + 100)
    },

    updateStationLayer (center, radius) {
      const ctx = this.stationCtx
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      const stationPos = {}
      for (let a of this.polarizedArrivals) {
        let dist = radius * (a.takeoff_angle > 90 ? 180 - a.takeoff_angle : a.takeoff_angle) / 90
        let xPos = center - dist * Math.cos(Math.PI * (a.azimuth - 90) / 180)
        let yPos = center - dist * Math.sin(Math.PI * (a.azimuth - 90) / 180)
        let key = a._pick._seedid.split('.').slice(0, 2).join('_')
        stationPos[key] = [xPos, yPos]
        ctx.beginPath()
        ctx.arc(xPos, yPos, 4, 0, 2 * Math.PI)
        if (a._pick.polarity === 'positive') {
          ctx.fill()
        } else {
          ctx.stroke()
        }
      }
      this.stationPos = stationPos
    },

    init () {
      if (this.focalMechanism != null) {
        this.strike = this.focalMechanism.nodal_planes.nodal_plane1.strike.value
        this.dip = this.focalMechanism.nodal_planes.nodal_plane1.dip.value
        this.rake = this.focalMechanism.nodal_planes.nodal_plane1.rake.value
        const [s, d, r] = [this.strike, this.dip, this.rake]
        this.oldStrike = s
        this.oldDip = d
        this.oldRake = r
      }
      let stationDistance = {}
      for (let a of this.polarizedArrivals) {
        let fdsnid = a._pick._fdsnid
        let netsta = fdsnid.split('.').slice(0, 2).join('.')
        stationDistance[netsta] = a.distance
      }
      utils.ajax({
        method: 'POST',
          url: this.$store.getters.getLink('takeoffangle'),
          dataMimeType: 'application/json',
          data: JSON.stringify({ depth: this.origin.depth.value / 1000, station: stationDistance }),
          type: 'json'
        }).then(toa => {
          for (let a of this.polarizedArrivals) {
            let fdsnid = a._pick._fdsnid
            let netsta = fdsnid.split('.').slice(0, 2).join('.')
            a.takeoff_angle = toa[netsta]
          }
          this.createBeachBall()
        })
    }
  }
}
</script>

<style>
.first-motion__container {
  position: relative;
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

