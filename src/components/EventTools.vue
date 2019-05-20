<template>
  <v-footer :value="true" fixed :height="70" :style="{ borderTop: '1px solid #ddd' }">
    <v-btn
      :color="origin._is_dirty ? 'orange' : 'white'"
      @click="handleRelocateClick"
      small>RELOCATE</v-btn>
    <div class="event-tools__select-wrapper">
      <v-select label="Locator" v-model="locator" :items="locatorOptions"></v-select>
    </div>
    <div class="event-tools__select-wrapper">
      <v-select label="Profile" v-model="profile" :items="profileOptions"></v-select>
    </div>
    <v-btn
      :color="event.preferred_magnitude_id == null ? 'orange' : 'white'"
      @click="handleComputeMagnitudeClick"
      small>COMPUTE MAGNITUDES</v-btn>
    <v-menu v-model="commitPopover" bottom offset-y :close-on-content-click="false">
      <template v-slot:activator="{ on }">
        <v-btn
          v-on="on"
          :color="origin._not_committed ? 'orange' : 'white'"
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
import utils from '@/utils/utils'

export default {

  data () {
    let locatorOptions = [ 'LOCSAT' ]
    let profileOptions = [ 'iasp91', 'tab' ]
    return {
      locator: locatorOptions[0],
      profile: profileOptions[0],
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
          'ice quak'
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
    }
  },

  methods: {

    handleRelocateClick () {
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
          console.log(e);
          let o = e.origin[0]
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
      this.$store.dispatch('setLoading', { value: true, text: 'Compute magnitudes, please wait...' })
      let e = utils.composeEvent({
        base: this.event, origins: [ this.origin ], po: this.origin
      })
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
          console.log(e);
          for (let m of e.magnitude) {
            m.origin_id = this.origin.public_id
            this.event.magnitude.push(m)
          }
          this.event.preferred_magnitude_id = e.magnitude[0].public_id
          this.event._pm = e.magnitude[0]
        }
      })
    },

    handleCommitClick () {
      this.$store.dispatch('setLoading', { value: true, text: 'Commit in progress...' })
      let e = this.event,
          o = this.origin
      e.type = this.commitForm.eventType
      e.type_certainty = this.commitForm.eventTypeCertainty
      e.preferred_origin_id = o.public_id
      o.evaluation_status = this.commitForm.originEvaluationStatus
      let cloneEvent = utils.cloneAndClean(e, '/event_parameters/event')
      // console.log(e);
      utils.ajax({
        method: 'POST',
        url: this.$store.getters.getLink('commit'),
        dataMimeType: 'application/json',
        data: JSON.stringify([ cloneEvent ]),
        type: 'json'
      }).then(data => {
        console.log(data);
        this.$store.dispatch('setLoading', { value: false })
        if (data.return_code == 0) {
          // o._not_committed = false
          this.commitPopover = false
          this.$emit('need-init')
          // this.handleSelectEvent(this.currentEvent.public_id)
        } else {
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
</style>
