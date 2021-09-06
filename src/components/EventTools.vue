<template>
  <v-footer :value="true" fixed :height="70" :style="{ borderTop: '1px solid #ddd' }">
    <v-btn
      :color="origin._is_dirty ? 'orange' : 'white'"
      light
      @click="handleRelocateClick"
      small>RELOCATE</v-btn>
    <div class="event-tools__select-wrapper">
      <v-select label="Locator" v-model="locator" :items="locatorOptions"></v-select>
    </div>
    <div class="event-tools__select-wrapper">
      <v-select label="Profile" v-model="profile" :items="profileOptions[locator]"></v-select>
    </div>
    <v-menu v-model="magnitudePopover" top left offset-y :close-on-content-click="false" :max-width="300">
      <template v-slot:activator="{ on }">
        <v-btn
          v-on="on" small @click="initStationMagnitude"
          light
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
  </v-footer>
</template>

<script>
import * as utils from '@/utils/utils'

export default {

  props: ['selectedStationMagnitude'],

  data () {
    let locatorOptions = [ 'LOCSAT', 'Hypo71' ]
    let profileOptions = {
      LOCSAT: [ 'iasp91', 'tab' ],
      Hypo71: [ 'ModelA', 'tectonic', 'volcanic' ]
    }
    return {
      magnitudePopover: false,
      stationMagnitude: [],
      locator: locatorOptions[0],
      profile: profileOptions[locatorOptions[0]][0],
      locatorOptions,
      profileOptions,
      commitPopover: false,
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
    event () {
      return this.$store.state.currentEvent
    },
    origin () {
      return this.$store.state.currentOrigin
    },
    focalMechanism () {
      return this.$store.state.currentFocalMechanism
    },
    commitButtonColor () {
      if (this.origin._not_committed || this.focalMechanism != null && this.focalMechanism._not_committed) {
        return 'orange'
      }
      return 'white'
    }
  },

  methods: {

    initStationMagnitude () {
      let tmp = {}
      // let prev = {}
      // for (let sm of this.stationMagnitude) {
      //   prev[sm.key] = sm.value
      // }
      for (let a of this.origin.arrival) {
        let netsta = a._pick._seedid.split('.').slice(0, 2).join('.')
        tmp[netsta] = null
      }
      let sm = []
      for (let netsta of Object.keys(tmp)) {
        // sm.push({ key: netSta, value: prev[netSta] != null ? prev[netSta] : true })
        sm.push({ key: netsta, value: this.selectedStationMagnitude.indexOf(netsta) >= 0 })
      }
      sm.sort((a, b) => {
        a = a.key
        b = b.key
        return a < b ? -1 : a > b ? 1 : 0
      })
      this.stationMagnitude = sm
    },

    handleRelocateClick () {
      this.$store.dispatch('setAuthorStatus', { eventid: this.event.public_id, action: 'relocating' })
      this.$store.dispatch('setLoading', { value: true, text: 'Relocate, please wait...' })
      // console.log(this.currentOrigin);
      let e = utils.composeEvent({
        base: this.event, origins: [ this.origin ], po: this.origin
      })
      utils.ajax({
        method: 'POST',
        url: this.$store.getters.getLink('relocate'),
        args: {
          locator: this.locator,
          profile: this.profile
        },
        dataMimeType: 'application/json',
        data: JSON.stringify([ e ]),
        type: 'json'
      }).then(data => {
        this.$store.dispatch('setLoading', { value: false })
        if (data.message != '') {
          alert(data.message)
        } else {
          let parser = new DOMParser()
          let qml = parser.parseFromString(data.quakeml, 'application/xml')
          // console.log(qml);
          let e = utils.parseQuakeML(qml)[0]
          console.log('[EventTools::handleRelocateClick] relocate result', e);
          let o = e.origin[0]
          o.creation_info.agency_id = this.event.creation_info.agency_id
          o.creation_info.author = this.$store.state.author
          o.evaluation_mode = 'manual'
          o._not_committed = true
          // keep only one not committed origin
          let notCommitted = this.event.origin.filter(x => x._not_committed)
          for (let origin of notCommitted) {
            this.event.origin.splice(this.event.origin.indexOf(origin), 1)
          }
          if (!this.origin._not_committed) {
            o.public_id = this.$store.getters.getId('Origin')
          }
          this.event.origin.push(o)
          this.event.preferred_magnitude_id = null
          this.event._pm = null
          this.$store.dispatch('setCurrentOrigin', o)
          this.$emit('need-update')
          utils.ajax({
            method: 'GET',
            url: this.$store.getters.getLink('region'),
            args: {
              latitude: o.latitude.value,
              longitude: o.longitude.value
            },
            type: 'json'
          }).then(data => {
            this.event.description = [{ type: 'region name', text: data }]
          })
        }
      })
    },

    handleComputeMagnitudeClick () {
      this.magnitudePopover = false
      this.$store.dispatch('setAuthorStatus', { eventid: this.event.public_id, action: 'computing magnitudes' })
      this.$store.dispatch('setLoading', { value: true, text: 'Compute magnitudes, please wait...' })
      let discardedStation = this.stationMagnitude.filter(x => x.value == false).map(x => x.key)
      let e = utils.composeEvent({
        base: this.event, origins: [ this.origin ], po: this.origin, discardedStation
      })
      delete e.amplitude
      delete e.station_magnitude
      utils.ajax({
        method: 'POST',
        url: this.$store.getters.getLink('compute_magnitudes'),
        dataMimeType: 'application/json',
        data: JSON.stringify([ e ]),
        type: 'json'
      }).then(data => {
        this.$store.dispatch('setLoading', { value: false })
        if (data.quakeml == null) {
          alert(data.message)
        }
        if (data.quakeml != null) {
          let parser = new DOMParser()
          let qml = parser.parseFromString(data.quakeml, 'application/xml')
          // console.log(qml);
          let e = utils.parseQuakeML(qml)[0]
          console.log('[EventTools::handleComputeMagnitudeClick] compute magnitude result', e);
          if (e.magnitude.length == 0) {
            alert('No magnitude computed.\n'+data.message)
            return
          }
          for (let a of e.amplitude) {
            if (this.event.amplitude == null) {
              this.event.amplitude = []
            }
            this.event.amplitude.push(a)
          }
          for (let sm of e.station_magnitude) {
            if (this.event.station_magnitude == null) {
              this.event.station_magnitude = []
            }
            this.event.station_magnitude.push(sm)
          }
          for (let m of e.magnitude) {
            if (this.event.magnitude == null) {
              this.event.magnitude = []
            }
            m.public_id = this.$store.getters.getId('Magnitude')
            m.creation_info.agency_id = this.event.creation_info.agency_id
            m.origin_id = this.origin.public_id
            this.event.magnitude.push(m)
          }
          this.event.preferred_magnitude_id = e.magnitude[0].public_id
          this.event._pm = e.magnitude[0]
          this.$emit('need-update')
        }
      })
    },

    handleCommitClick () {
      let e = this.event,
          o = this.origin,
          fm = this.focalMechanism
      e.type = this.commitForm.eventType
      e.type_certainty = this.commitForm.eventTypeCertainty
      e.preferred_origin_id = o.public_id
      o.evaluation_status = this.commitForm.originEvaluationStatus
      if (fm != null) {
        e.preferred_focal_mechanism = fm.public_id
      }
      let cloneEvent = utils.cloneAndClean(e, '/event_parameters/event')
      console.log('[EventTools::handleCommitClick] commit', cloneEvent)
      if (cloneEvent.preferred_magnitude_id == null) {
        if (!confirm('You are about to commit an event with no magnitude. Do you really want to proceed ?')) {
          return
        }
      }
      this.$store.dispatch('setAuthorStatus', { eventid: this.event.public_id, action: 'committing' })
      this.$store.dispatch('setLoading', { value: true, text: 'Commit in progress...' })
      utils.ajax({
        method: 'POST',
        url: this.$store.getters.getLink('commit'),
        dataMimeType: 'application/json',
        data: JSON.stringify([ cloneEvent ]),
        type: 'json'
      }).then(data => {
        console.log('[EventTools::handleCommitClick] commit result', data);
        if (data.return_code == 0) {
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
      })
    }

  }

}
</script>

<style lang="css">
.event-tools__select-wrapper {
  display: inline-block;
  max-width: 200px;
  margin-right: 10px;
}

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
