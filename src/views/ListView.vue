<template>
  <v-card>
    <v-tabs v-model="activeTab" right>
      <v-tab>List</v-tab>
      <v-tab>Map</v-tab>
      <v-tab-item>
        <v-data-table :headers="tableHeader" :items="tableData" :pagination.sync="pagination">
          <template v-slot:items="props">
            <tr :class="tableRowClassName(props.item)" @click="handleRowClick(props.item)">
              <td><div :style="{ minWidth: '140px' }">{{ props.item.time }}</div></td>
              <td class="font-weight-bold">{{ props.item.mag }}</td>
              <td>{{ props.item.magType }}</td>
              <td class="text-xs-right">{{ props.item.phase }}</td>
              <td class="text-xs-right"><div :style="{ minWidth: '60px' }">{{ props.item.lat }}</div></td>
              <td class="text-xs-right"><div :style="{ minWidth: '60px' }">{{ props.item.lon }}</div></td>
              <td class="text-xs-right"><div :style="{ minWidth: '60px' }">{{ props.item.depth }}</div></td>
              <td><v-chip label outline small :color="props.item.modeColor">{{ props.item.mode }}</v-chip></td>
              <td>{{ props.item.eventType }}</td>
              <td><div :style="{ minWidth: '200px' }">{{ props.item.region }}</div></td>
              <td>{{ props.item.author }}</td>
              <td>{{ props.item.id }}</td>
            </tr>
          </template>
        </v-data-table>
      </v-tab-item>
      <v-tab-item>
        <div class="list-view__map-canvas"></div>
      </v-tab-item>
    </v-tabs>
  </v-card>
</template>

<script>
import utils from '@/utils/utils'
import L from 'leaflet'

export default {

  props: [ 'start', 'end', 'minlat', 'maxlat', 'minlon', 'maxlon', 'mindepth', 'maxdepth', 'minmag', 'maxmag' ],

  data () {
    return {
      activeTab: 0,
      tableHeader: [
        { text: 'Time', value: 'time' },
        { text: 'M', value: 'mag' },
        { text: 'MT', value: 'magType' },
        { text: 'Ph.', value: 'phase', align: 'right' },
        { text: 'Lat', value: 'lat', align: 'right' },
        { text: 'Lon', value: 'lon', align: 'right' },
        { text: 'Depth', value: 'depth', align: 'right' },
        { text: 'Mode', value: 'mode', sortable: false },
        { text: 'Type', value: 'eventType' },
        { text: 'Region', value: 'region', sortable: false },
        { text: 'Author', value: 'author', sortable: false },
        { text: 'ID', value: 'id' }
      ],
      pagination: {
        descending: true,
        page: 1,
        rowsPerPage: -1,
        sortBy: 'time',
        totalItems: 0
      },
      tableData: [],
      map: null
      // height: 500
    }
  },

  mounted () {
    let dirty = false
    let query = Object.assign(Object.assign({}, this.$store.state.form), this.$route.query)
    for (let [k, v] of Object.entries(query)) {
      if (this.$store[k] != v) {
        dirty = true
        break
      }
    }
    if (dirty && this.$store.state.eventList.length <= 1) {
      this.$store.dispatch('setFormValues', this.$route.query)
      this.$store.dispatch('setLoading', { value: true, text: 'Loading events...' })
      let args = {}
      for (let [k, v] of Object.entries(this.$store.state.form)) {
        if (v != null) {
          args[k] = v
        }
      }
      utils.ajax({
        method: 'GET',
        url: 'fdsnws/event/1/query',
        args: args,
        type: 'document'
      }).then(qml => {
        let events = utils.parseQuakeML(qml)
        this.$store.dispatch('eventList', events)
        let data = this.getTableData()
        this.pagination.totalItems = data.length
        this.tableData = data
        this.$store.dispatch('setLoading', { value: false })
      })
    } else {
      let data = this.getTableData()
      this.pagination.totalItems = data.length
      this.tableData = data
    }
  },

  watch: {
    activeTab: function (newValue, oldValue) {
      if (newValue == 1 && this.map == null) {
        setTimeout(() => {
          this.initMap()
        }, 500)
      }
    }
  },

  methods: {

    initMap () {
      let map = L.map(this.$el.querySelector('.list-view__map-canvas'), {trackResize: false, attributionControl: false})
      let worldtopomap = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, HERE, DeLorme, TomTom, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, <br>Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), swisstopo, MapmyIndia, © OpenStreetMap contributors, and the GIS User Community'
      })
      let satmap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, <br>USGS, AEX, Getmapping, Aerogrid, IGN, IGP, swisstopo, and the GIS User Community'
      })
      let baseLayers = {
        Terrain: worldtopomap,
        Satellite: satmap
      }
      L.control.layers(baseLayers).addTo(map);
      L.control.scale({ imperial: false }).addTo(map)
      worldtopomap.addTo(map)
      let bounds = []
      this.map = map
      for (let e of this.$store.state.eventList) {
        let m
        let pos = [e._po.latitude.value, e._po.longitude.value]
        bounds.push(pos)
        if (e._pm == null) {
          m = L.circleMarker(pos, { radius: 10, weight: 1, color: 'gray', fillOpacity: 0.5 })
        } else {
          m = L.circleMarker(pos, {
            radius: 4 + e._pm.mag.value * 2,
            weight: 1,
            fillOpacity: 0.5,
            color: e._po.evaluation_mode == 'manual' ? 'lime' : 'red'
          })
        }
        m.addTo(map)
      }
      map.fitBounds(bounds)
    },

    tableRowClassName (row) {
      return this.$store.state.currentEvent != null && this.$store.state.currentEvent.public_id == row.id ? 'selected-event-row' : ''
    },

    handleRowClick (row) {
      if (row != null) {
        this.$router.push({ name: 'Event', params: { code: row.id } })
      }
    },

    getTableData () {
      return this.$store.state.eventList.map(e => ({
        time: e._po.time._pretty,
        mag: e._pm ? e._pm.mag._pretty : '--',
        magType: e._pm ? e._pm.type : '--',
        phase: e._po.quality.used_phase_count,
        lat: e._po.latitude._pretty,
        lon: e._po.longitude._pretty,
        depth: e._po.depth._pretty,
        eventType: e.type ? e.type : '',
        mode: e._po.evaluation_mode == 'manual' ? 'M' : 'A',
        modeColor: e._po.evaluation_mode == 'manual' ? 'green' : 'red',
        author: e._po.creation_info.author,
        region: e.description[0].text,
        id: e.public_id
      }))
    }

  }
}
</script>

<style lang="css">
.selected-event-row {
  background-color: #e7f9ff !important;
}
.list-view__map-canvas {
  height: 80vh;
}
</style>
