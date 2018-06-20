<template>
  <el-row>
    <el-col :span="12">
      <div class="map-canvas"></div>
    </el-col>
    <el-col :span="12">
      <el-form ref="form" :model="form" label-width="200px">
        <el-form-item label="Start time">
          <el-date-picker
            value-format="yyyy-MM-dd"
            v-model="form.starttime"
            type="date"
          ></el-date-picker>
        </el-form-item>
        <el-form-item label="End time">
          <el-date-picker
            value-format="yyyy-MM-dd"
            v-model="form.endtime"
            type="date"
          ></el-date-picker>
        </el-form-item>
        <el-form-item label="Latitude min [°]">
          <el-input-number v-model="form.minlat" :min="-90" :max="90" :step="0.01"></el-input-number>
        </el-form-item>
        <el-form-item label="Latitude max  [°]">
          <el-input-number v-model="form.maxlat" :min="-90" :max="90" :step="0.01"></el-input-number>
        </el-form-item>
        <el-form-item label="Longitude min  [°]">
          <el-input-number v-model="form.minlon" :min="-180" :max="180" :step="0.01"></el-input-number>
        </el-form-item>
        <el-form-item label="Longitude max  [°]">
          <el-input-number v-model="form.maxlon" :min="-180" :max="180" :step="0.01"></el-input-number>
        </el-form-item>
        <el-form-item label="Depth min [km]">
          <el-input-number v-model="form.mindepth" :min="0" :max="750" :step="1"></el-input-number>
        </el-form-item>
        <el-form-item label="Depth max [km]">
          <el-input-number v-model="form.maxdepth" :min="0" :max="750" :step="1"></el-input-number>
        </el-form-item>
        <el-form-item label="Magnitude min">
          <el-input-number v-model="form.minmag" :min="0" :max="750" :step="1"></el-input-number>
        </el-form-item>
        <el-form-item label="Magnitude max">
          <el-input-number v-model="form.maxmag" :min="0" :max="750" :step="1"></el-input-number>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submitForm">Submit</el-button>
          <el-button @click="resetForm">Reset</el-button>
        </el-form-item>
      </el-form>
    </el-col>
  </el-row>
</template>

<script>
import SelectArea from '../utils/selectArea.js'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

export default {
  data () {
    let now = new Date().getTime()
    return {
      map: null,
      area: null,
      form: {
        starttime: new Date(now - 7 * 86400000).toISOString().split('T')[0],
        endtime: new Date(now + 86400000).toISOString().split('T')[0],
        minlat: -90,
        maxlat: 90,
        minlon: -180,
        maxlon: 180,
        mindepth: 0,
        maxdepth: 750,
        minmag: undefined,
        maxmag: undefined
      }
    }
  },

  watch: {
    'form.minlat': function() {this.applyBoundsToArea()},
    'form.minlon': function() {this.applyBoundsToArea()},
    'form.maxlat': function() {this.applyBoundsToArea()},
    'form.maxlon': function() {this.applyBoundsToArea()}
  },

  activated () {
    if (this.map == null && this.area == null) {

      this.initMapAndArea()
    }
  },

  computed: {
    bounds: function() {
      return [[this.form.minlat, this.form.minlon], [this.form.maxlat, this.form.maxlon]]
    }
  },

  methods: {
    initMapAndArea () {
      let container = this.$el.querySelector('.map-canvas')
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
      this.map.fitBounds(this.bounds)
    },

    submitForm () {
      this.$emit('submit-event-form', this.form)
    },

    resetForm () {
      this.$refs.form.resetFields()
    }
  }
}
</script>

<style>

</style>
