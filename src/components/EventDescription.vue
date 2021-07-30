<template>
  <div>
    <v-layout wrap>
      <v-flex xs12 md4>
        <h4>Event info</h4>
        <table class="event-description__table">
          <thead><tr><th>Type</th><th>Type certainty</th><th>Status</th></tr></thead>
          <tbody>
            <tr>
              <td>{{ event.type }}</td>
              <td>{{ event.type_certainty }}</td>
              <td>{{ origin.evaluation_status }}</td>
            </tr>
          </tbody>
        </table>
      </v-flex>
      <v-flex xs12 md4 class="ml-3">
        <h4>Locator info</h4>
        <table class="event-description__table">
          <thead><tr><th>Method</th><th>Earth model</th></tr></thead>
          <tbody>
            <tr>
              <td>{{ origin.method_id }}</td>
              <td>{{ origin.earth_model_id }}</td>
            </tr>
          </tbody>
        </table>
      </v-flex>
    </v-layout>

    <v-switch v-model="originSelectorMode" label="Selector mode" class="justify-end"></v-switch>

    <div>
      <h4>Origin</h4>
      <table class="event-description__table">
        <thead>
          <tr>
            <th v-if="originSelectorMode"></th>
            <th v-if="originSelectorMode">Creation time</th>
            <th v-if="originSelectorMode">Agency</th>
            <th v-if="originSelectorMode">Author</th>
            <th>Time</th><th>Latitude</th><th>Longitude</th><th>Depth</th><th>Phases</th><th>RMS</th><th>Az. Gap</th><th>Min Dist</th>
          </tr>
        </thead>
        <tbody class="selectable" v-if="originSelectorMode">
          <tr
            v-for="o in event.origin"
            :key="o.public_id"
            :class="{ preferred: o.public_id == event.preferred_origin_id }"
            @click="handleSetCurrentOrigin(o)"
            @dblclick="handleSetPreferredOrigin(o)">
            <td><v-icon v-if="o == origin">mdi-eye</v-icon></td>
            <td>{{ o.creation_info._pretty_creation_time }}</td>
            <td>{{ o.creation_info.agency_id }}</td>
            <td>{{ o.creation_info.author }}</td>
            <td>{{ o.time._pretty }}</td>
            <td>{{ o.latitude._pretty }} {{ o.latitude._pretty_uncertainty }}</td>
            <td>{{ o.longitude._pretty }} {{ o.longitude._pretty_uncertainty }}</td>
            <td>{{ o.depth._pretty }} {{ o.depth._pretty_uncertainty }}</td>
            <td>{{ o.quality.used_phase_count }} / {{ o.quality.associated_phase_count }}</td>
            <td>{{ o.quality.standard_error.toFixed(2) }} s</td>
            <td>{{ o.quality.azimuthal_gap.toFixed(0) }} °</td>
            <td>{{ o.quality.minimum_distance.toFixed(2) }} °</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td>{{ origin.time._pretty }}</td>
            <td>{{ origin.latitude._pretty }} {{ origin.latitude._pretty_uncertainty }}</td>
            <td>{{ origin.longitude._pretty }} {{ origin.longitude._pretty_uncertainty }}</td>
            <td>{{ origin.depth._pretty }} {{ origin.depth._pretty_uncertainty }}</td>
            <td>{{ origin.quality.used_phase_count }} / {{ origin.quality.associated_phase_count }}</td>
            <td>{{ origin.quality.standard_error.toFixed(2) }} s</td>
            <td>{{ origin.quality.azimuthal_gap.toFixed(0) }} °</td>
            <td>{{ origin.quality.minimum_distance.toFixed(2) }} °</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div>
      <h4>Magnitude</h4>
      <div v-if="event._pm == null && !originSelectorMode">
        <v-alert type="error" :value="true">No preferred magnitude</v-alert>
      </div>
      <table class="event-description__table" v-else>
        <thead>
          <tr>
            <th v-if="originSelectorMode">Creation time</th>
            <th v-if="originSelectorMode">Agency</th>
            <th v-if="originSelectorMode">Author</th>
            <th>Value</th>
            <th>Magnitude type</th>
            <th>Station count</th>
            <th>Method</th>
            <th>Station magnitudes</th>
          </tr>
        </thead>
        <tbody class="selectable" v-if="originSelectorMode">
          <tr
            v-for="m in originMagnitude"
            :key="m.public_id"
            :class="{ preferred: m.public_id == event.preferred_magnitude_id }"
            @dblclick="handleSetPreferredMagnitude(m)">
            <td>{{ m.creation_info._pretty_creation_time }}</td>
            <td>{{ m.creation_info.agency_id }}</td>
            <td>{{ m.creation_info.author }}</td>
            <td>{{ m.mag._pretty }}</td>
            <td>{{ m.type }}</td>
            <td>{{ m.station_count }}</td>
            <td>{{ m.method_id }}</td>
            <td>
              <button
                v-if="magDetails == m"
                @click="magDetails = null" class="primary--text">hide</button>
              <button
                v-else-if="m.station_magnitude_contribution != null"
                @click="magDetails = m" class="primary--text">show</button>
              <span v-else>-</span>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td>{{ event._pm.mag._pretty }}</td>
            <td>{{ event._pm.type }}</td>
            <td>{{ event._pm.station_count }}</td>
            <td>{{ event._pm.method_id }}</td>
            <td>
              <button
                v-if="magDetails == event._pm"
                @click="magDetails = null" class="primary--text">hide</button>
              <button
                v-else-if="event._pm.station_magnitude_contribution != null"
                @click="magDetails = event._pm" class="primary--text">show</button>
              <span v-else>-</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="magDetails != null">
        <v-layout row wrap>
          <v-flex md8>
            <h4>Station magnitudes</h4>
          </v-flex>
          <v-flex md4 class="text-xs-right">
            <button @click="magDetails = null" class="primary--text">hide</button>
          </v-flex>
        </v-layout>
        <table class="event-description__table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>SNR</th>
              <th>Type</th>
              <th>Magnitude</th>
              <th>Residual</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(smc, i) in magDetails.station_magnitude_contribution" :key="i">
              <td>{{ smc._station_magnitude._seedid }}</td>
              <td>{{ smc._station_magnitude._amplitude.snr.toFixed(2) }}</td>
              <td>{{ smc._station_magnitude.type }}</td>
              <td>{{ smc._station_magnitude.mag._pretty }}</td>
              <td>{{ smc._pretty_residual }}</td>
              <td>{{ smc._pretty_weight }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
export default {

  data () {
    return {
      originSelectorMode: false,
      magDetails: null
    }
  },

  computed: {
    event () {
      return this.$store.state.currentEvent
    },
    origin () {
      return this.$store.state.currentOrigin
    },
    originMagnitude () {
      return this.event.magnitude.filter(m => m.origin_id == this.origin.public_id)
    }
  },

  watch: {
    'event._pm': function (newValue, oldValue) {
      this.magDetails = null
    }
  },

  methods: {

    handleSetCurrentOrigin (o) {
      this.magDetails = null
      this.$store.dispatch('setCurrentOrigin', o)
      this.$emit('need-update')
    },

    handleSetPreferredOrigin (o) {
      this.origin._not_committed = false
      this.event.preferred_origin_id = o.public_id
      o._not_committed = true
      this.$store.dispatch('setCurrentEvent', this.event)
      this.$emit('need-update')
    },

    handleSetPreferredMagnitude (m) {
      let e = this.event
      e.preferred_magnitude_id = m.public_id
      e._pm = m
      this.origin._not_committed  = true
    }

  }

}
</script>

<style lang="css">
.event-description__table {width: 100%; font-size: .8em; margin-top: 5px; margin-bottom: 10px;}
.event-description__table th, td {padding: 4px; text-align: center;}
.event-description__table th {font-weight: bold; background: #efefef;}
.event-description__table tr.preferred td {font-weight: bold;}
.event-description__table .selectable tr:hover {background-color: #fbfbfb; cursor: pointer;}
.application.theme--dark .event-description__table th {background: #5e5e5e;}
</style>
