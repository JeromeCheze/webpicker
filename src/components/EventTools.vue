<template>
  <v-footer :value="true" fixed :height="70" :style="{ borderTop: '1px solid #ddd' }">
    <v-btn
      :color="origin._is_dirty ? 'orange' : 'white'"
      light
      @click="handleRelocateClick"
      class="ma-1"
      small>RELOCATE</v-btn>
    <div class="mx-2 pt-3">
      <v-select label="Locator" v-model="locator" :items="locatorOptions" dense/>
    </div>
    <div class="mx-2 pt-3">
      <v-select label="Profile" v-model="profile" :items="profileOptions[locator]" dense/>
    </div>
    <v-menu v-model="magnitudePopover" top left offset-y :close-on-content-click="false" :max-width="300">
      <template v-slot:activator="{ on }">
        <v-btn
          v-on="on" small @click="initStationMagnitude"
          light
          class="ma-1"
          :color="event.preferred_magnitude_id == null ? 'orange' : 'white'">
          MAGNITUDE
        </v-btn>
      </template>
      <v-card>
        <v-card-title>
          <h4>Station magnitude configuration</h4>
        </v-card-title>
        <v-divider></v-divider>
        <v-card-text style="height: 300px; overflow-y: auto;">
          <p>Define which station could be used for magnitude computation.</p>
          <div v-for="(item, index) in stationMagnitude" :key="index">
            <label class="event-tools__station-mag-checkbox">
              <input type="checkbox" v-model="stationMagnitude[index].value"> {{ item.key }}
            </label>
          </div>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="white"
            light
            @click="handleComputeMagnitudeClick"
            class="ma-1"
            small>COMPUTE</v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>
    <v-menu v-model="commitPopover" top offset-y :close-on-content-click="false">
      <template v-slot:activator="{ on }">
        <v-btn
          v-on="on"
          :color="commitButtonColor"
          light
          class="ma-1"
          small>COMMIT</v-btn>
      </template>
      <v-card class="pa-3">
        <v-select
          label="Event type"
          v-model="commitForm.eventType"
          :items="commitForm.eventTypeOptions"
          clearable
        ></v-select>
        <v-select
          label="Type certainty"
          v-model="commitForm.eventTypeCertainty"
          :items="commitForm.eventTypeCertaintyOptions"
          clearable
        ></v-select>
        <v-select
          label="Origin status"
          v-model="commitForm.originEvaluationStatus"
          :items="commitForm.evaluationStatusOptions"
          clearable
        ></v-select>
        <v-btn small @click="commitPopover = false">Cancel</v-btn>
        <v-btn small color="primary" @click="handleCommitClick">Commit</v-btn>
      </v-card>
    </v-menu>
    <v-spacer></v-spacer>
    <v-btn
      small
      class="ma-1"
      @click="unselectS"
      title="Discard S arrivals (relocation is required after)"
    >Unselect S</v-btn>
    <v-btn
      small
      class="ma-1"
      @click="handleKeepUsedArrival"
      :disabled="!origin._not_committed"
      title="Keep used arrivals by deleting discarded (use with caution!)"
    >Keep used</v-btn>
  </v-footer>
</template>

<script lang="ts">
import Vue from 'vue'
import * as utils from '@/utils/utils'
import { EventToolsStationMagnitudeItem, StringIndexedObject, WebpickerEventParameters, WebpickerFocalMechanism, WebpickerOrigin } from '@/types'

export default Vue.extend({

  props: {
    selectedStationMagnitude: {
      type: Array,
      default: () => []
    }
  },

  data () {
    const locatorOptions = ['LOCSAT', 'Hypo71']
    const profileOptions: StringIndexedObject = {
      LOCSAT: ['iasp91', 'tab'],
      Hypo71: ['ModelA', 'tectonic', 'volcanic']
    }
    return {
      magnitudePopover: false,
      stationMagnitude: [] as EventToolsStationMagnitudeItem[],
      locator: locatorOptions[0],
      profile: profileOptions[locatorOptions[0]][0],
      locatorOptions,
      profileOptions,
      commitPopover: false,
      keyDownBinded: false,
      commitForm: {
        eventType: 'earthquake',
        eventTypeCertainty: null,
        originEvaluationStatus: null,
        eventTypeCertaintyOptions: [
          'known',
          'suspected'
        ],
        evaluationStatusOptions: [
          'preliminary',
          'confirmed',
          'reviewed',
          'final',
          'rejected'
        ],
        eventTypeOptions: [
          'not existing',
          'other event',
          'earthquake',
          'quarry blast',
          'explosion',
          'not reported',
          'anthropogenic event',
          'collapse',
          'cavity collapse',
          'mine collapse',
          'building collapse',
          'accidental explosion',
          'chemical explosion',
          'controlled explosion',
          'experimental explosion',
          'industrial explosion',
          'mining explosion',
          'road cut',
          'blasting levee',
          'nuclear explosion',
          'induced or triggered event',
          'rock burst',
          'reservoir loading',
          'fluid injection',
          'fluid extraction',
          'crash',
          'plane crash',
          'train crash',
          'boat crash',
          'atmospheric event',
          'sonic boom',
          'sonic blast',
          'acoustic noise',
          'thunder',
          'avalanche',
          'snow avalanche',
          'debris avalanche',
          'hydroacoustic event',
          'ice quak',
          'slide',
          'landslide',
          'rockslide',
          'meteorite',
          'volcanic eruption'
        ]
      }
    }
  },

  computed: {
    event (): WebpickerEventParameters {
      return this.$store.state.currentEvent
    },
    origin (): WebpickerOrigin {
      return this.$store.state.currentOrigin
    },
    focalMechanism (): WebpickerFocalMechanism {
      return this.$store.state.currentFocalMechanism
    },
    commitButtonColor (): string {
      if (this.origin._not_committed || (this.focalMechanism != null && this.focalMechanism._not_committed)) {
        return 'orange'
      }
      return 'white'
    }
  },

  mounted () {
    if (!this.keyDownBinded) {
      this.keyDownBinded = true
      document.body.addEventListener('keydown', this.handleKeyDown)
    }
  },

  beforeDestroy () {
    document.body.removeEventListener('keydown', this.handleKeyDown)
  },

  methods: {

    handleKeyDown (ev: KeyboardEvent) {
      const k = utils.shortcutString(ev)
      if (k === 'alt+r') {
        this.handleRelocateClick()
      } else if (k === 'alt+m') {
        this.handleComputeMagnitudeClick()
      } else if (k === 'alt+c') {
        this.handleCommitClick()
      }
    },

    handleKeepUsedArrival () {
      this.origin.arrival = this.origin.arrival.filter(a => a.time_weight > 0.5)
      this.$emit('need-update')
    },

    unselectS () {
      for (const a of this.origin.arrival) {
        if (a.phase === 'S') {
          a.time_weight = 0
        }
      }
      this.origin._is_dirty = true
      this.$emit('need-update')
    },

    initStationMagnitude () {
      const tmp: StringIndexedObject = {}
      // let prev = {}
      // for (let sm of this.stationMagnitude) {
      //   prev[sm.key] = sm.value
      // }
      for (const a of this.origin.arrival) {
        const netsta = a._pick._seedid.split('.').slice(0, 2).join('.')
        tmp[netsta] = null
      }
      const sm = []
      for (const netsta of Object.keys(tmp)) {
        // sm.push({ key: netSta, value: prev[netSta] != null ? prev[netSta] : true })
        sm.push({ key: netsta, value: this.selectedStationMagnitude.indexOf(netsta) >= 0 })
      }
      sm.sort((a, b) => {
        const aa = a.key
        const bb = b.key
        return aa < bb ? -1 : aa > bb ? 1 : 0
      })
      this.stationMagnitude = sm
    },

    handleRelocateClick () {
      this.$store.dispatch('setAuthorStatus', { eventid: this.event.public_id, action: 'relocating' })
      this.$store.dispatch('setLoading', { value: true, text: 'Relocate, please wait...' })
      // console.log(this.currentOrigin);
      const e = utils.composeEvent({
        base: this.event, origins: [this.origin], po: this.origin
      })
      this.$store.dispatch('log', '[EventTools::handleRelocateClick] send relocate request')
      utils.ajax({
        method: 'POST',
        url: this.$store.getters.getLink('relocate'),
        args: {
          locator: this.locator,
          profile: this.profile
        },
        dataMimeType: 'application/json',
        data: JSON.stringify([e]),
        type: 'json'
      }).then(response => {
        const data = response as {message: string, quakeml: string}
        this.$store.dispatch('setLoading', { value: false })
        if (data.message !== '') {
          alert(data.message)
        } else {
          const parser = new DOMParser()
          const qml = parser.parseFromString(data.quakeml, 'application/xml')
          // console.log(qml);
          const e = utils.parseQuakeML(qml)[0]
          console.log('[EventTools::handleRelocateClick] relocate result', e)
          this.$store.dispatch('log', '[EventTools::handleRelocateClick] relocate result')

          const o = e.origin[0]
          o.creation_info.agency_id = this.event.creation_info!.agency_id
          o.creation_info.author = this.$store.state.author
          o.evaluation_mode = 'manual'
          o._not_committed = true
          // keep only one not committed origin
          const notCommitted = this.event.origin.filter(x => x._not_committed)
          for (const origin of notCommitted) {
            this.event.origin.splice(this.event.origin.indexOf(origin), 1)
          }
          if (!this.origin._not_committed) {
            o.public_id = this.$store.getters.getId('Origin')
          }
          this.event.origin.push(o)
          this.event.preferred_magnitude_id = null
          this.event._pm = null
          this.$store.dispatch('setCurrentOrigin', o)
          this.event.preferred_origin_id = o.public_id
          this.event._po = o
          this.$emit('need-update')
          this.$store.dispatch('log', '[EventTools::handleRelocateClick] send region name request')
          utils.ajax({
            method: 'GET',
            url: this.$store.getters.getLink('region'),
            args: {
              latitude: o.latitude.value,
              longitude: o.longitude.value
            },
            type: 'json'
          }).then(data => {
            this.$store.dispatch('log', `[EventTools::handleRelocateClick] send region name request response: ${data}`)
            this.event.description = [{ type: 'region name', text: data as string }]
          }).catch(data => {
            this.$store.dispatch('log', `[EventTools::handleRelocateClick] send region name request failed: ${data}`)
          })
        }
      }).catch(data => {
        this.$store.dispatch('log', `[EventTools::handleRelocateClick] send relocate request failed : ${data}`)
      })
    },

    handleComputeMagnitudeClick () {
      this.magnitudePopover = false
      this.$store.dispatch('setAuthorStatus', { eventid: this.event.public_id, action: 'computing magnitudes' })
      this.$store.dispatch('setLoading', { value: true, text: 'Compute magnitudes, please wait...' })
      const discardedStation = this.stationMagnitude.filter(x => x.value === false).map(x => x.key)
      const e = utils.composeEvent({
        base: this.event, origins: [this.origin], po: this.origin, discardedStation
      })
      delete e.amplitude
      delete e.station_magnitude
      console.log('[EventTools::handleComputeMagnitudeClick] send compute magnitude request')
      utils.ajax({
        method: 'POST',
        url: this.$store.getters.getLink('compute_magnitudes'),
        dataMimeType: 'application/json',
        data: JSON.stringify([e]),
        type: 'json'
      }).then(response => {
        const data = response as {message: string, quakeml: string}
        this.$store.dispatch('setLoading', { value: false })
        if (data.quakeml == null) {
          alert(data.message)
        }
        if (data.quakeml != null) {
          const parser = new DOMParser()
          const qml = parser.parseFromString(data.quakeml, 'application/xml')
          // console.log(qml);
          const e = utils.parseQuakeML(qml)[0]
          console.log('[EventTools::handleComputeMagnitudeClick] compute magnitude result', e)
          this.$store.dispatch('log', '[EventTools::handleComputeMagnitudeClick] compute magnitude result')
          if (e.magnitude.length === 0) {
            alert('No magnitude computed.\n' + data.message)
            return
          }
          for (const a of e.amplitude) {
            if (this.event.amplitude == null) {
              this.event.amplitude = []
            }
            this.event.amplitude.push(a)
          }
          for (const sm of e.station_magnitude) {
            if (this.event.station_magnitude == null) {
              this.event.station_magnitude = []
            }
            this.event.station_magnitude.push(sm)
          }
          for (const m of e.magnitude) {
            if (this.event.magnitude == null) {
              this.event.magnitude = []
            }
            m.public_id = this.$store.getters.getId('Magnitude')
            m.creation_info.agency_id = this.event.creation_info!.agency_id
            m.origin_id = this.origin.public_id
            this.event.magnitude.push(m)
          }
          this.event.preferred_magnitude_id = e.magnitude[0].public_id
          this.event._pm = e.magnitude[0]
          this.$emit('need-update')
        }
      }).catch(data => {
        this.$store.dispatch('log', `[EventTools::handleComputeMagnitudeClick] send compute magnitude request failed: ${data}`)
      })
    },

    handleCommitClick () {
      const e = this.event
      const o = this.origin
      const fm = this.focalMechanism
      e.type = this.commitForm.eventType
      e.type_certainty = this.commitForm.eventTypeCertainty
      e.preferred_origin_id = o.public_id
      o.evaluation_status = this.commitForm.originEvaluationStatus
      if (fm != null) {
        e.preferred_focal_mechanism_id = fm.public_id
      }
      const cloneEvent = utils.cloneAndClean(e, '/event_parameters/event') as WebpickerEventParameters
      if (cloneEvent.preferred_magnitude_id == null) {
        if (!confirm('You are about to commit an event with no magnitude. Do you really want to proceed ?')) {
          return
        }
      }
      console.log('[EventTools::handleCommitClick] commit', cloneEvent)
      this.$store.dispatch('log', '[EventTools::handleCommitClick] commit')
      this.$store.dispatch('setAuthorStatus', { eventid: this.event.public_id, action: 'committing' })
      this.$store.dispatch('setLoading', { value: true, text: 'Commit in progress...' })
      utils.ajax({
        method: 'POST',
        url: this.$store.getters.getLink('commit'),
        dataMimeType: 'application/json',
        data: JSON.stringify([cloneEvent]),
        type: 'json'
      }).then(response => {
        const data = response as {'return_code': number, message: string}
        console.log('[EventTools::handleCommitClick] commit result', data)
        if (data.return_code === 0) {
          this.$store.dispatch('log', '[EventTools::handleCommitClick] commit successful')
          // o._not_committed = false
          setTimeout(() => {
            this.commitPopover = false
            // delay event reload to make sure that seiscomp had enough time
            // to process it through spread and everything is written in database
            this.$emit('need-init')
          }, 1000)
          this.commitPopover = false
          // this.$emit('need-init')
        } else {
          this.$store.dispatch('setLoading', { value: false })
          alert(data.message)
        }
      }).catch(data => {
        this.$store.dispatch('log', `[EventTools::handleCommitClick] send commit request failed: ${data}`)
        alert('Ooops, something went wrong 😕 but don\'t worry it happens sometimes, please try to commit again 😉\n\n(if it occurs again, please contact the admin)')
        this.$store.dispatch('setLoading', { value: false })
      })
    }

  }

})
</script>

<style lang="css">
.event-tools__station-mag-checkbox,
.event-tools__station-mag-checkbox input {
  cursor: pointer;
}
.event-tools__station-mag-checkbox input {
  background-color: #af4646;
}
.event-tools__station-mag-checkbox input:checked {
  background-color: #82b1ff;
}
</style>
