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
            <v-flex xs12 md6 class="pa-3"><v-text-field type="number" v-model="form.minlat" label="Latitude min [°]"></v-text-field></v-flex>
            <v-flex xs12 md6 class="pa-3"><v-text-field type="number" v-model="form.maxlat" label="Latitude max [°]"></v-text-field></v-flex>
          </v-layout>
          <v-layout wrap>
            <v-flex xs12 md6 class="pa-3"><v-text-field type="number" v-model="form.minlon" label="Longitude min [°]"></v-text-field></v-flex>
            <v-flex xs12 md6 class="pa-3"><v-text-field type="number" v-model="form.maxlon" label="Longitude max [°]"></v-text-field></v-flex>
          </v-layout>
          <v-layout wrap>
            <v-flex xs12 class="px-4">
              <v-checkbox v-model="rememberGeoConstraints" label="Remember geographical constraints"/>
            </v-flex>
          </v-layout>
          <v-layout wrap>
            <v-flex xs12 md6 class="pa-3"><v-text-field type="number" v-model="form.mindepth" label="Depth min [km]"></v-text-field></v-flex>
            <v-flex xs12 md6 class="pa-3"><v-text-field type="number" v-model="form.maxdepth" label="Depth max [km]"></v-text-field></v-flex>
          </v-layout>
          <v-layout wrap>
            <v-flex xs12 md6 class="pa-3"><v-text-field type="number" v-model="form.minmag" label="Magnitude min"></v-text-field></v-flex>
            <v-flex xs12 md6 class="pa-3"><v-text-field type="number" v-model="form.maxmag" label="Magnitude max"></v-text-field></v-flex>
          </v-layout>
          <div class="text-right">
            <v-btn @click="handleSubmit" color="primary">Submit</v-btn>
          </div>
        </v-flex>
      </v-layout>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import Vue from 'vue'
import SelectArea from '@/utils/selectArea'
import L from 'leaflet'
import { WebpickerForm } from '@/types'
import { Dictionary } from 'highcharts'

export default Vue.extend({
  data () {
    return {
      map: null as L.Map | null,
      area: null as SelectArea | null,
      rememberGeoConstraints: localStorage.getItem('form') != null,
      startMenu: false,
      endMenu: false,
      form: Object.assign({}, this.$store.state.form) as WebpickerForm
    }
  },

  mounted () {
    if (this.map == null && this.area == null) {
      this.initMapAndArea()
    }
  },

  watch: {
    'form.minlat': function () { this.applyBoundsToArea() },
    'form.minlon': function () { this.applyBoundsToArea() },
    'form.maxlat': function () { this.applyBoundsToArea() },
    'form.maxlon': function () { this.applyBoundsToArea() }
  },

  computed: {
    bounds (): L.LatLngTuple[] {
      return [[this.form.minlat, this.form.minlon], [this.form.maxlat, this.form.maxlon]]
    }
  },

  methods: {

    allowedStartDate (v: string) {
      const start = new Date(v).getTime()
      const end = new Date(this.form.end).getTime()
      return start < end
    },

    allowedEndDate (v: string) {
      const start = new Date(this.form.start).getTime()
      const end = new Date(v).getTime()
      const now = new Date(new Date().toISOString().slice(0, 10)).getTime() + 86400e3
      return end > start && end <= now
    },

    initMapAndArea () {
      const container: (HTMLElement | null) = this.$el.querySelector('#form-view__map')
      if (container == null) {
        return
      }
      const width = container.getBoundingClientRect().width
      container.style.height = `${width}px`
      const map = L.map(container, { trackResize: false, attributionControl: false })
      const worldtopomap = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, HERE, DeLorme, TomTom, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, <br>Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), swisstopo, MapmyIndia, © OpenStreetMap contributors, and the GIS User Community'
      })
      worldtopomap.addTo(map)
      L.control.scale({ imperial: false }).addTo(map)
      this.area = new SelectArea(this.bounds).addTo(map).on('boundschange', () => this.applyBoundsToForm())
      this.map = map
      map.fitBounds(this.bounds)
    },

    applyBoundsToForm () {
      const b = this.area!.getBounds()
      const [ne, sw] = [b[1], b[0]]
      this.form.minlat = sw[0]
      this.form.minlon = sw[1]
      this.form.maxlat = ne[0]
      this.form.maxlon = ne[1]
    },

    applyBoundsToArea () {
      this.area!.setBounds(this.bounds)
    },

    handleSubmit () {
      const query: Dictionary<string | (string | null)[] | null | undefined> = {}
      for (const [k, v] of Object.entries(this.form)) {
        if (v != null) {
          query[k] = `${v}`
        }
      }
      if (query.minmag == null) {
        delete query.minmag
      }
      if (query.maxmag == null) {
        delete query.maxmag
      }
      if (this.rememberGeoConstraints) {
        localStorage.setItem('form', JSON.stringify({
          minlat: query.minlat,
          maxlat: query.maxlat,
          minlon: query.minlon,
          maxlon: query.maxlon
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
})
</script>
