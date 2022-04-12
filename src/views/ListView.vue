<template>
  <v-card>
    <div class="px-3 py-1">
      <v-checkbox v-model="hideDiscardedEvents" label="Hide discarded events"></v-checkbox>
    </div>
    <v-tabs v-model="activeTab" right>
      <v-tab><v-icon>mdi-view-list</v-icon></v-tab>
      <v-tab><v-icon>mdi-map</v-icon></v-tab>
    </v-tabs>
    <v-tabs-items touchless v-model="activeTab">
      <v-tab-item>
        <v-data-table :headers="tableHeader" :items="tableData" :pagination.sync="pagination" disable-initial-sort>
          <template v-slot:items="props">
            <tr :class="tableRowClassName(props.item)" @click="handleRowClick(props.item)">
              <td v-if="props.item.activity != null">
                <v-menu offset-x open-on-hover>
                  <template v-slot:activator="{ on }">
                    <v-icon v-on="on" color="primary">mdi-account</v-icon>
                  </template>
                  <v-card>
                    <v-card-text>
                      <div v-for="(msg, index) in props.item.activity" :key="index">{{ msg }}</div>
                    </v-card-text>
                  </v-card>
                </v-menu>
              </td>
              <td v-else></td>
              <td><div :style="{ minWidth: '140px' }">{{ props.item.time }}</div></td>
              <td class="font-weight-bold">{{ props.item.mag }}</td>
              <td>{{ props.item.magType }}</td>
              <td class="text-xs-right">{{ props.item.phase }}</td>
              <td class="text-xs-right"><div :style="{ minWidth: '60px' }">{{ props.item.lat }}</div></td>
              <td class="text-xs-right"><div :style="{ minWidth: '60px' }">{{ props.item.lon }}</div></td>
              <td class="text-xs-right"><div :style="{ minWidth: '60px' }">{{ props.item.depth }}</div></td>
              <td><v-chip label outline small :color="props.item.modeColor">{{ props.item.mode }}</v-chip></td>
              <td>{{ props.item.status }}</td>
              <td>{{ props.item.eventType }}</td>
              <td><div :style="{ minWidth: '250px' }">{{ props.item.region }}</div></td>
              <td>{{ props.item.author }}</td>
              <td>{{ props.item.id }}</td>
            </tr>
          </template>
        </v-data-table>
      </v-tab-item>
      <v-tab-item>
        <div class="list-view__map-canvas"></div>
      </v-tab-item>
    </v-tabs-items>
    <v-bottom-sheet v-model="bottomSheet">
      <v-card class="pa-3">
        <table v-if="mapSelectedEvent != null" class="list-view__map-table">
          <thead>
            <tr>
              <th></th>
              <th>Time</th>
              <th>M</th>
              <th>MT</th>
              <th>Ph.</th>
              <th>Lat</th>
              <th>Lon</th>
              <th>Depth</th>
              <th>Mode</th>
              <th>Type</th>
              <th>Region</th>
              <th>Author</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            <tr @click="handleRowClick({ id: mapSelectedEvent.public_id })">
              <td v-if="$store.getters.getEventActivity[mapSelectedEvent.public_id] != null">
                <v-menu offset-x open-on-hover>
                  <template v-slot:activator="{ on }">
                    <v-icon v-on="on" color="primary">mdi-account</v-icon>
                  </template>
                  <v-card>
                    <v-card-text>
                      <div v-for="(msg, index) in $store.getters.getEventActivity[mapSelectedEvent.public_id]" :key="index">{{ msg }}</div>
                    </v-card-text>
                  </v-card>
                </v-menu>
              </td>
              <td v-else></td>
              <td>{{ mapSelectedEvent._po.time._pretty }}</td>
              <td>{{ mapSelectedEvent._pm ? mapSelectedEvent._pm.mag._pretty : '--' }}</td>
              <td>{{ mapSelectedEvent._pm ? mapSelectedEvent._pm.type : '--' }}</td>
              <td>{{ mapSelectedEvent._po.quality.used_phase_count }}</td>
              <td>{{ mapSelectedEvent._po.latitude._pretty }}</td>
              <td>{{ mapSelectedEvent._po.longitude._pretty }}</td>
              <td>{{ mapSelectedEvent._po.depth._pretty }}</td>
              <td>{{ mapSelectedEvent._po.evaluation_mode == 'manual' ? 'M' : 'A' }}</td>
              <td>{{ mapSelectedEvent.type ? mapSelectedEvent.type : '' }}</td>
              <td>{{ mapSelectedEvent._region }}</td>
              <td>{{ mapSelectedEvent._po.creation_info.author }}</td>
              <td>{{ mapSelectedEvent.public_id }}</td>
            </tr>
          </tbody>
        </table>
      </v-card>
    </v-bottom-sheet>
  </v-card>
</template>

<script>
import * as utils from '@/utils/utils'
import L from 'leaflet'

export default {

  data () {
    return {
      activeTab: 0,
      tableHeader: [
        { text: ' ', value: 'activity' },
        { text: 'Time', value: 'time' },
        { text: 'M', value: 'mag' },
        { text: 'MT', value: 'magType' },
        { text: 'Ph.', value: 'phase', align: 'right' },
        { text: 'Lat', value: 'lat', align: 'right' },
        { text: 'Lon', value: 'lon', align: 'right' },
        { text: 'Depth', value: 'depth', align: 'right' },
        { text: 'Mode', value: 'mode', sortable: true },
        { text: 'Status', value: 'status', sortable: true },
        { text: 'Type', value: 'eventType' },
        { text: 'Region', value: 'region', sortable: false },
        { text: 'Author', value: 'author', sortable: false },
        { text: 'ID', value: 'id' }
      ],
      hideDiscardedEvents: false,
      pagination: {
        descending: true,
        page: 1,
        rowsPerPage: -1,
        sortBy: 'time',
        totalItems: 0
      },
      tableData: [],
      map: null,
      bottomSheet: false,
      mapSelectedEvent: null,
      markerMap: {}
      // height: 500
    }
  },

  mounted () {
    this.$store.dispatch('setAuthorStatus', { eventid: 'null', action: 'browsing' })
    let dirty = false
    let query = Object.assign(Object.assign({}, this.$store.state.form), this.$route.query)
    for (let [k, v] of Object.entries(query)) {
      if (this.$store[k] != v) {
        dirty = true
        break
      }
    }
    if (dirty && this.$store.state.eventList.length <= 1 || this.$store.state.eventListDirty) {
      this.$store.dispatch('setFormValues', this.$route.query)
      this.$store.dispatch('setLoading', { value: true, text: 'Loading events...' })
      this.loadEvents()
    } else {
      let data = this.getTableData()
      this.pagination.totalItems = data.length
      this.tableData = data
    }
  },

  computed: {
    filteredEvents () {
      return this.$store.state.eventList.filter(e => {
        return (
          !this.hideDiscardedEvents ||
          this.hideDiscardedEvents && (
            e.type == null || ['not existing', 'other event'].indexOf(e.type) == -1
          )
        )
      })
    }
  },

  watch: {
    activeTab: function (newValue, oldValue) {
      if (newValue == 0) {
        this.updateTable()
      } else if (newValue == 1) {
        setTimeout(() => {
          if (this.map == null) {
            this.initMap()
          } else {
            this.plotEvents()
          }
        }, 500)
      }
    },

    hideDiscardedEvents: function (newValue, oldValue) {
      this.activeTab == 0 ? this.updateTable() : this.plotEvents()
    },

    '$store.getters.getEventActivity': function (newValue, oldValue) {
      let data = this.getTableData()
      this.pagination.totalItems = data.length
      this.tableData = data
    },

    '$store.state.eventListDirty': function (newValue, oldValue) {
      if (newValue) {
        this.loadEvents()
      }
    }
  },

  methods: {

    loadEvents () {
      let args = {}
      for (let [k, v] of Object.entries(this.$store.state.form)) {
        if (v != null) {
          args[k] = v
        }
      }
      args.format = 'xml'
      this.$store.dispatch('log', `[ListView::initEvent] send loading catalog request`)
      utils.ajax({
        method: 'GET',
        url: this.$store.getters.getLink('fdsnws/event/1/query'),
        args: args,
        type: 'document'
      }).then(qml => {
        let events = utils.parseQuakeML(qml)
        this.$store.dispatch('eventList', events)
        let data = this.getTableData()
        this.pagination.totalItems = data.length
        this.tableData = data
      }).catch(data => {
        this.$store.dispatch('log', `[ListView::initEvent] send loading catalog request failed: ${data}`)
      }).finally(() => {
        this.$store.dispatch('setLoading', { value: false })
      })
    },

    filterEvents (events) {
      let result = events
      if (this.hideDiscardedEvents) {
        result = events.filter(e => {
          e.type == null || ['not existing', 'other'].indexOf(e.type) == -1
        })
      }
      return result
    },

    getEventColor (e) {
      if (['not existing', 'not reported', 'other event'].indexOf(e.type) >= 0) {
        return [ 'gray', 'gray' ]
      }
      let strokeColor = e._po.evaluation_mode == 'manual' ? 'lime' : 'red'
      if (e._pm == null) {
        return [ 'blue', strokeColor ]
      } else {
        if (['explosion', 'quarry blast'].indexOf(e.type) >= 0) {
          return ['yellow', strokeColor ]
        } else if (e.type == 'earthquake') {
          return [ 'lime', strokeColor ]
        } else {
          return [ 'transparent', strokeColor ]
        }
      }
    },

    initMap () {
      let map = L.map(this.$el.querySelector('.list-view__map-canvas'), {trackResize: false, attributionControl: false})
      this.map = map
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
      this.plotEvents()
    },

    plotEvents () {
      for (let [k, v] of Object.entries(this.markerMap)) {
        v.remove()
        delete this.markerMap[k]
      }
      let bounds = []
      for (let e of this.filteredEvents) {
        let pos = [e._po.latitude.value, e._po.longitude.value]
        bounds.push(pos)
        let [fillColor, color] = this.getEventColor(e)
        let m = L.circleMarker(pos, {
          radius: e._pm == null ? 10 : 4 + e._pm.mag.value * 2,
          weight: 2,
          fillOpacity: 0.5,
          color,
          fillColor
        })
        this.markerMap[e.public_id] = m
        m.bindPopup(e.public_id)
        m.on('click', () => this.handleMarkerClick(e))
        m.addTo(this.map)
      }
      this.map.fitBounds(bounds)
      if (this.$store.state.currentEvent != null) {
        this.handleMarkerClick(this.$store.state.currentEvent)
      }
    },

    tableRowClassName (row) {
      return this.$store.state.currentEvent != null && this.$store.state.currentEvent.public_id == row.id ? 'selected-event-row' : ''
    },

    handleMarkerClick(e) {
      let m = this.markerMap[e.public_id]
      if (m) {
        m.openPopup()
        this.mapSelectedEvent = e
        this.bottomSheet = true
      }
    },

    handleRowClick (row) {
      if (row != null) {
        this.$router.push({ name: 'Event', params: { code: row.id } })
      }
    },

    updateTable () {
      let data = this.getTableData()
      this.pagination.totalItems = data.length
      this.tableData = data
    },

    getTableData () {
      let activity = this.$store.getters.getEventActivity
      return this.filteredEvents.map(e => ({
        activity: activity[e.public_id] != null ? activity[e.public_id] : null,
        time: e._po.time._pretty,
        mag: e._pm ? e._pm.mag._pretty : '--',
        magType: e._pm ? e._pm.type : '--',
        phase: e._po.quality.used_phase_count,
        lat: e._po.latitude._pretty,
        lon: e._po.longitude._pretty,
        depth: e._po.depth._pretty,
        eventType: e.type ? e.type : '',
        mode: e._po.evaluation_mode == 'manual' ? 'M' : 'A',
        status: e._po.evaluation_status != null ? e._po.evaluation_status : '',
        modeColor: e._po.evaluation_mode == 'manual' ? 'green' : 'red',
        author: e._po.creation_info.author,
        region: e._region,
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
.application.theme--dark .selected-event-row {
  background-color: #197492 !important;
}
.list-view__map-canvas {
  height: 80vh;
  z-index: 1;
}
.list-view__map-table {width: 100%;}
.list-view__map-table tr:hover {background-color: #d1edf5; cursor: pointer;}
.list-view__map-table th, td {padding: 4px; text-align: center;}
.list-view__map-table th {font-weight: bold; background: #efefef;}
.application.theme--dark .list-view__map-table th {background-color: #5e5e5e;}
</style>
