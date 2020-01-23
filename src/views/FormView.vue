<template>
  <v-card>
    <v-card-text>
      <v-layout wrap>
        <v-flex xs12 md6>
          <div id="form-view__map" :style="{ zIndex: 1 }"></div>
        </v-flex>
        <v-flex xs12 md6>
          <v-layout wrap>
            <v-flex xs12 md6 class="pa-3">
              <v-menu offset-y :close-on-content-click="false" v-model="startMenu">
                <template v-slot:activator="{ on }">
                  <v-text-field v-on="on" v-model="form.start" label="Start" prepend-icon="mdi-calendar"></v-text-field>
                </template>
                <v-date-picker v-model="form.start" :allowed-dates="allowedStartDate"></v-date-picker>
              </v-menu>
            </v-flex>
            <v-flex xs12 md6 class="pa-3">
              <v-menu offset-y :close-on-content-click="false" v-model="endMenu">
                <template v-slot:activator="{ on }">
                  <v-text-field v-on="on" v-model="form.end" label="End" prepend-icon="mdi-calendar"></v-text-field>
                </template>
                <v-date-picker v-model="form.end" :allowed-dates="allowedEndDate"></v-date-picker>
              </v-menu>
            </v-flex>
          </v-layout>
          <v-layout wrap>
            <v-flex xs12 md6 class="pa-3"><number-field v-model="form.minlat" label="Latitude min [°]"></number-field></v-flex>
            <v-flex xs12 md6 class="pa-3"><number-field v-model="form.maxlat" label="Latitude max [°]"></number-field></v-flex>
          </v-layout>
          <v-layout wrap>
            <v-flex xs12 md6 class="pa-3"><number-field v-model="form.minlon" label="Longitude min [°]"></number-field></v-flex>
            <v-flex xs12 md6 class="pa-3"><number-field v-model="form.maxlon" label="Longitude max [°]"></number-field></v-flex>
          </v-layout>
          <v-layout wrap>
            <v-flex xs12 class="px-4">
              <v-checkbox v-model="rememberGeoConstraints" label="Remember geographical constraints"/>
            </v-flex>
          </v-layout>
          <v-layout wrap>
            <v-flex xs12 md6 class="pa-3"><number-field v-model="form.mindepth" label="Depth min [km]"></number-field></v-flex>
            <v-flex xs12 md6 class="pa-3"><number-field v-model="form.maxdepth" label="Depth max [km]"></number-field></v-flex>
          </v-layout>
          <v-layout wrap>
            <v-flex xs12 md6 class="pa-3"><number-field v-model="form.minmag" label="Magnitude min"></number-field></v-flex>
            <v-flex xs12 md6 class="pa-3"><number-field v-model="form.maxmag" label="Magnitude max"></number-field></v-flex>
          </v-layout>
          <div class="text-xs-right">
            <v-btn @click="handleSubmit" color="primary">Submit</v-btn>
          </div>
        </v-flex>
      </v-layout>
    </v-card-text>
  </v-card>
</template>

<script>
import SelectArea from '@/utils/selectArea.js'
import * as utils from '@/utils/utils'
import L from 'leaflet'

export default {
  data () {
    return {
      map: null,
      area: null,
      rememberGeoConstraints: localStorage.getItem('form') != null,
      startMenu: false,
      endMenu: false,
      form: Object.assign({}, this.$store.state.form)
    }
  },

  mounted () {
    if (this.map == null && this.area == null) {
      this.initMapAndArea()
    }
  },

  watch: {
    'form.minlat': function() { this.applyBoundsToArea() },
    'form.minlon': function() { this.applyBoundsToArea() },
    'form.maxlat': function() { this.applyBoundsToArea() },
    'form.maxlon': function() { this.applyBoundsToArea() }
  },

  computed: {
    bounds: function() {
      return [[this.form.minlat, this.form.minlon], [this.form.maxlat, this.form.maxlon]]
    }
  },

  methods: {

    allowedStartDate (v) {
      let start = new Date(v).getTime()
      let end = new Date(this.form.end).getTime()
      return start < end
    },

    allowedEndDate (v) {
      let start = new Date(this.form.start).getTime()
      let end = new Date(v).getTime()
      let now = new Date(new Date().toISOString().slice(0, 10)).getTime() + 86400e3
      return end > start && end <= now
    },

    initMapAndArea () {
      let container = this.$el.querySelector('#form-view__map')
      let width = container.getBoundingClientRect().width
      container.style.height = `${width}px`
      let map = L.map(container, {trackResize: false, attributionControl: false})
      let worldtopomap = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, HERE, DeLorme, TomTom, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, <br>Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), swisstopo, MapmyIndia, © OpenStreetMap contributors, and the GIS User Community'
      })
      worldtopomap.addTo(map)
      L.control.scale({ imperial: false }).addTo(map)
      this.area = new SelectArea(this.bounds).addTo(map).on('boundschange', () => this.applyBoundsToForm());
      this.map = map
      map.fitBounds(this.bounds)
    },

    applyBoundsToForm () {
      let b = this.area.getBounds()
      let [ne, sw] = [b.getNorthEast(), b.getSouthWest()]
      this.form.minlat = sw.lat
      this.form.minlon = sw.lng
      this.form.maxlat = ne.lat
      this.form.maxlon = ne.lng
    },

    applyBoundsToArea () {
      this.area.setBounds(this.bounds)
    },

    handleSubmit () {
      let query = Object.assign({}, this.form)
      if (query.minmag == null) {
        delete query.minmag
      }
      if (query.maxmag == null) {
        delete query.maxmag
      }
      if (this.rememberGeoConstraints) {
        localStorage.setItem('form', JSON.stringify({
          minlat: query.minlat, maxlat: query.maxlat,
          minlon: query.minlon, maxlon: query.maxlon
        }))
      } else {
        localStorage.removeItem('form')
      }
      this.$store.dispatch('eventList', [])
      this.$router.push({ name: 'List', query })
    }

    // resetForm () {
    //   this.$refs.form.resetFields()
    // }
  }
}
</script>
