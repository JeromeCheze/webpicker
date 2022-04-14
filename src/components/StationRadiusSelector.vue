<template>
  <v-dialog v-model="dialog" width="600">
    <template v-slot:activator="{ on }">
      <v-btn icon title="Load station radius" :disabled="disabled" v-on="on">
        <v-icon>mdi-less-than-or-equal</v-icon>
      </v-btn>
    </template>
    <v-card>
      <v-card-text class="pa-1">
        <div class="station-radius-selector__map-canvas"></div>
        <v-toolbar dense>
          <number-field
            @input="handleRadiusChange"
            :value="radius"
            :style="{ maxWidth: '60px' }"
            label="Radius"
            hide-details
          ></number-field>
          <v-divider vertical class="mx-2"></v-divider>
          <v-checkbox
            v-model="alterOriginLocation"
            label="set center as origin location"
            :disabled="!dirty"
            hide-details
          ></v-checkbox>
          <v-btn @click="resetCenter" flat :disabled="!dirty">Reset center</v-btn>
          <v-divider vertical></v-divider>
          <v-btn @click="submit" color="primary" flat>Submit</v-btn>
        </v-toolbar>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import Vue from 'vue'
import * as utils from '@/utils/utils'
import L from 'leaflet'

export default Vue.extend({
  props: ['value', 'disabled'],

  data () {
    return {
      alterOriginLocation: false,
      map: null as L.Map | null,
      dialog: false,
      dirty: false,
      center: null as L.Marker | null,
      resize: null as L.Marker | null,
      circle: null as L.Circle | null,
      radius: this.value,
      layers: [] as L.Layer[]
    }
  },

  watch: {
    dialog: function (value, oldValue) {
      if (value === true) {
        this.initMap()
      }
    }
  },

  methods: {
    initMap () {
      setTimeout(() => {
        let container = document.body.querySelector('.station-radius-selector__map-canvas')
        if (this.map == null) {
          this.map = utils.initMap(container)
        } else {
          for (let l of this.layers) {
            l.remove()
          }
          this.layers = []
        }
        let bounds: L.LatLngExpression[] = []
        let po = this.$store.state.currentOrigin
        let inv = this.$store.state.inventory
        for (let a of po.arrival) {
          let [net, sta] = a._pick._seedid.split('.').slice(0, 2)
          let staPos: L.LatLngTuple = [inv[net][sta].lat, inv[net][sta].lon]
          let m = L.circleMarker(staPos, {
            radius: 3,
            color: a.time_weight >= 0.5 ? 'green' : 'gray',
            weight: 1,
            fillOpacity: 0.5
          }).addTo(this.map)
          this.layers.push(m)
          bounds.push(m.getLatLng())
        }
        let pos = L.latLng(po.latitude.value, po.longitude.value)
        this.circle = L.circle(pos, { radius: utils.deg2m(this.radius) }).addTo(this.map)
        this.center = L.marker(pos, {
          icon: L.divIcon({ className: 'circle c-move', iconSize: [10, 10] }),
          draggable: true
        }).addTo(this.map)
        this.resize = L.marker([pos.lat + this.radius, pos.lng], {
          icon: L.divIcon({ className: 'circle c-ns-resize', iconSize: [10, 10] }),
          draggable: true
        }).addTo(this.map)
        this.center.on('drag', () => {
          let newPos = this.center!.getLatLng()
          this.circle!.setLatLng(newPos)
          this.resize!.setLatLng([newPos.lat + this.radius, newPos.lng])
          this.dirty = true
        })
        this.resize.on('drag', () => {
          let dist = this.circle!.getLatLng().distanceTo(this.resize!.getLatLng())
          this.radius = utils.m2deg(dist)
          this.circle!.setRadius(dist)
        })
        this.layers.push(this.circle)
        this.layers.push(this.center)
        this.layers.push(this.resize)
        this.map.setView(pos, 7)
        this.map.fitBounds(this.circle.getBounds().extend(bounds as L.LatLngBoundsExpression))
      }, 200)
    },

    handleRadiusChange (r: number) {
      this.radius = r
      let pos = this.center!.getLatLng()
      this.circle!.setRadius(utils.deg2m(r))
      this.resize!.setLatLng([pos.lat + r, pos.lng])
    },

    resetCenter () {
      let po = this.$store.state.currentOrigin
      let pos = L.latLng(po.latitude.value, po.longitude.value)
      this.circle!.setLatLng(pos)
      this.center!.setLatLng(pos)
      this.resize!.setLatLng([pos.lat + this.radius, pos.lng])
      this.dirty = false
      this.alterOriginLocation = false
    },

    submit () {
      this.$emit('input', this.radius)
      let pos = this.center!.getLatLng()
      if (this.alterOriginLocation) {
        this.$emit('changeLocation', { latitude: pos.lat, longitude: pos.lng })
      }
      this.$emit('submit', { latitude: pos.lat, longitude: pos.lng })
      this.dialog = false
    }
  }
})
</script>

<style>
.station-radius-selector__map-canvas {
  height: 400px;
}

.circle {
  width: 10px;
  height: 10px;
  background: white;
  border: 1px solid black;
  border-radius: 6px;
}

.c-move {
  cursor: move;
}

.c-ns-resize {
  cursor: ns-resize;
}
</style>
