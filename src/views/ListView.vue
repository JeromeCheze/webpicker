<template>
  <v-card>
    <v-row>
      <v-col cols="3" class="mx-4">
        <v-checkbox v-model="hideDiscardedEvents" label="Hide discarded events"></v-checkbox>
      </v-col>
    </v-row>
    <v-tabs v-model="activeTab" right>
      <v-tab><v-icon>mdi-view-list</v-icon></v-tab>
      <v-tab><v-icon>mdi-map</v-icon></v-tab>
      <v-tab><v-icon>mdi-chart-box-outline</v-icon></v-tab>
    </v-tabs>
    <v-tabs-items touchless v-model="activeTab">
      <v-tab-item>
        <v-data-table :headers="tableHeader" :items="tableData" :items-per-page="-1" :sort-desc.sync="sortDesc" :sort-by.sync="sortBy">
          <template v-slot:item="props">
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
              <td class="text-xs-right"><div :style="{ minWidth: '60px' }">{{ props.item.rms.toFixed(2) }}</div></td>
              <td><v-chip label outlined small :color="props.item.modeColor">{{ props.item.mode }}</v-chip></td>
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
      <v-tab-item>
        <v-row>
          <v-col cols="12" md="8">
            <div class="list-view__chart--temporal-distribution"></div>
          </v-col>
          <v-col cols="12" md="4">
            <div class="list-view__chart--temporal-gutemberg-richter"></div>
          </v-col>
        </v-row>
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

<script lang="ts">
import Vue from 'vue'
import * as utils from '@/utils/utils'
import L from 'leaflet'
import { ListViewDataTableRow, StringIndexedObject, WebpickerEventParameters } from '@/types'
import Graticule from '@/plugins/graticule'
import Highcharts from 'highcharts'

export default Vue.extend({

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
        { text: 'RMS', value: 'rms', align: 'right', sortable: true },
        { text: 'Mode', value: 'mode', sortable: true },
        { text: 'Status', value: 'status', sortable: true },
        { text: 'Type', value: 'eventType' },
        { text: 'Region', value: 'region', sortable: false },
        { text: 'Author', value: 'author', sortable: false },
        { text: 'ID', value: 'id' }
      ],
      hideDiscardedEvents: false,
      sortBy: 'time',
      sortDesc: true,
      tableData: [] as ListViewDataTableRow[],
      map: null as L.Map | null,
      bottomSheet: false,
      mapSelectedEvent: null as WebpickerEventParameters | null,
      markerMap: {} as Record<string, L.Layer>
      // height: 500
    }
  },

  mounted () {
    this.$store.dispatch('setAuthorStatus', { eventid: 'null', action: 'browsing' })
    let dirty = false
    const query = Object.assign(Object.assign({}, this.$store.state.form), this.$route.query)
    for (const [k, v] of Object.entries(query)) {
      if (this.$store.state.form[k] !== v) {
        dirty = true
        break
      }
    }
    if ((dirty && this.$store.state.eventList.length <= 1) || this.$store.state.eventListDirty) {
      this.$store.dispatch('setFormValues', this.$route.query)
      this.$store.dispatch('setLoading', { value: true, text: 'Loading events...' })
      this.loadEvents()
    } else {
      const data = this.getTableData()
      this.tableData = data
    }
  },

  computed: {
    filteredEvents () {
      return this.$store.state.eventList.filter((e: WebpickerEventParameters) => {
        return (
          !this.hideDiscardedEvents ||
          (this.hideDiscardedEvents && (
            e.type == null || ['not existing', 'other event', 'not reported'].indexOf(e.type) === -1
          ))
        )
      })
    }
  },

  watch: {
    activeTab: function (newValue, oldValue) {
      if (newValue === 0) {
        this.updateTable()
      } else if (newValue === 1) {
        setTimeout(() => {
          if (this.map == null) {
            this.initMap()
          } else {
            this.plotEvents()
          }
        }, 500)
      } else if (newValue === 2) {
        setTimeout(() => {
          this.renderCharts()
        }, 500)
      }
    },

    hideDiscardedEvents: function (newValue, oldValue) {
      this.activeTab === 0 ? this.updateTable() : this.plotEvents()
    },

    '$store.getters.getEventActivity': function (newValue, oldValue) {
      const data = this.getTableData()
      this.tableData = data
    },

    '$store.state.eventListDirty': function (newValue, oldValue) {
      if (newValue) {
        this.loadEvents()
      }
    },

    filteredEvents: function () {
      if (this.activeTab === 2) {
        this.renderCharts()
      }
    }
  },

  methods: {

    loadEvents () {
      const args: StringIndexedObject = {}
      for (const [k, v] of Object.entries(this.$store.state.form)) {
        if (v != null) {
          args[k] = v
        }
      }
      args.format = 'xml'
      this.$store.dispatch('log', '[ListView::initEvent] send loading catalog request')
      utils.ajax({
        method: 'GET',
        url: this.$store.getters.getLink('fdsnws/event/1/query'),
        args: args,
        type: 'document'
      }).then(qml => {
        const events = utils.parseQuakeML(qml as Document)
        this.$store.dispatch('eventList', events)
        const data = this.getTableData()
        this.tableData = data
      }).catch(data => {
        this.$store.dispatch('log', `[ListView::initEvent] send loading catalog request failed: ${data}`)
      }).finally(() => {
        this.$store.dispatch('setLoading', { value: false })
      })
    },

    filterEvents (events: WebpickerEventParameters[]) {
      let result = events
      if (this.hideDiscardedEvents) {
        result = events.filter(e => {
          return e.type == null || ['not existing', 'other'].indexOf(e.type) === -1
        })
      }
      return result
    },

    getEventColor (e: WebpickerEventParameters) {
      if (['not existing', 'not reported', 'other event'].indexOf(e.type!) >= 0) {
        return ['grey', 'grey']
      }
      const strokeColor = e._po!.evaluation_mode === 'manual' ? 'lime' : 'red'
      if (e._pm == null) {
        return ['blue', strokeColor]
      } else {
        if (['explosion', 'quarry blast'].indexOf(e.type!) >= 0) {
          return ['yellow', strokeColor]
        } else if (e.type === 'earthquake') {
          return ['lime', strokeColor]
        } else {
          return ['transparent', strokeColor]
        }
      }
    },

    initMap () {
      const container: HTMLElement | null = this.$el.querySelector('.list-view__map-canvas')
      if (container == null) {
        return
      }
      const map = L.map(container, { trackResize: false, attributionControl: false })
      this.map = map
      const worldtopomap = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, HERE, DeLorme, TomTom, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, <br>Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), swisstopo, MapmyIndia, © OpenStreetMap contributors, and the GIS User Community'
      })
      const satmap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, <br>USGS, AEX, Getmapping, Aerogrid, IGN, IGP, swisstopo, and the GIS User Community'
      })
      const baseLayers = {
        Terrain: worldtopomap,
        Satellite: satmap
      }
      L.control.layers(baseLayers).addTo(map)
      L.control.scale({ imperial: false }).addTo(map)
      worldtopomap.addTo(map)
      const graticule = new Graticule()
      graticule.addTo(map)
      this.plotEvents()
    },

    plotEvents () {
      if (this.map == null) {
        return
      }
      for (const [k, v] of Object.entries(this.markerMap)) {
        v.remove()
        delete this.markerMap[k]
      }
      const bounds: L.LatLngBoundsExpression = []
      for (const e of this.filteredEvents) {
        const pos: L.LatLngExpression = [e._po.latitude.value, e._po.longitude.value]
        bounds.push(pos)
        const [fillColor, color] = this.getEventColor(e)
        const m = L.circleMarker(pos, {
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

    tableRowClassName (row: ListViewDataTableRow) {
      return this.$store.state.currentEvent != null && this.$store.state.currentEvent.public_id === row.id ? 'selected-event-row' : ''
    },

    handleMarkerClick (e: WebpickerEventParameters) {
      const m = this.markerMap[e.public_id]
      if (m) {
        m.openPopup()
        this.mapSelectedEvent = e
        this.bottomSheet = true
      }
    },

    handleRowClick (row: ListViewDataTableRow) {
      if (row != null) {
        this.$router.push({ name: 'Event', params: { code: row.id } })
      }
    },

    updateTable () {
      const data = this.getTableData()
      this.tableData = data
    },

    getTableData (): ListViewDataTableRow[] {
      const activity = this.$store.getters.getEventActivity
      return this.filteredEvents.map((e: WebpickerEventParameters) => ({
        activity: activity[e.public_id] != null ? activity[e.public_id] : null,
        time: e._po!.time._pretty,
        mag: e._pm ? e._pm.mag._pretty : '--',
        magType: e._pm ? e._pm.type : '--',
        phase: e._po!.quality.used_phase_count,
        lat: e._po!.latitude._pretty,
        lon: e._po!.longitude._pretty,
        depth: e._po!.depth._pretty,
        rms: e._po?.quality.standard_error,
        eventType: e.type ? e.type : '',
        mode: e._po!.evaluation_mode === 'manual' ? 'M' : 'A',
        status: e._po!.evaluation_status != null ? e._po!.evaluation_status : '',
        modeColor: e._po!.evaluation_mode === 'manual' ? 'green' : 'red',
        author: e._po!.creation_info.author,
        region: e._region,
        id: e.public_id
      }))
    },

    renderCharts () {
      const tdContainer: HTMLElement | null = this.$el.querySelector('.list-view__chart--temporal-distribution')
      const grContainer: HTMLElement | null = this.$el.querySelector('.list-view__chart--temporal-gutemberg-richter')
      if (tdContainer == null || grContainer == null) {
        return
      }
      const filteredEvents = this.filteredEvents as WebpickerEventParameters[]
      const events = filteredEvents.map(e => ({
        time: e._po!.time._value,
        mag: e._pm != null ? e._pm.mag.value : null,
        public_id: e.public_id,
        color: this.getEventColor(e)
      }))
      events.sort((a, b) => {
        const aa = a.time
        const bb = b.time
        return aa < bb ? -1 : aa > bb ? 1 : 0
      })
      const eventsPerDay: {x: number; y: number}[] = []
      const scatterMag: {x: number, y: number, name: string, color: string}[] = []
      let currDay = null
      for (const event of events) {
        if (event.mag == null) {
          continue
        }
        const t = event.time.getTime()
        const eventDay = t - (t % 86400e3)
        if (currDay == null) {
          currDay = { x: eventDay, y: 0 }
        }
        if (currDay.x === eventDay) {
          currDay.y++
        } else {
          eventsPerDay.push(currDay)
          currDay = null
        }
        scatterMag.push({
          x: event.time.getTime(),
          y: event.mag,
          name: event.public_id,
          color: event.color[0] === 'transparent' ? event.color[1] : event.color[0]
        })
      }
      if (currDay != null) {
        eventsPerDay.push(currDay)
      }
      Highcharts.chart({
        chart: {
          renderTo: tdContainer,
          zoomType: 'x',
          backgroundColor: 'transparent'
        },
        title: { text: 'Temporal distribution', style: { color: '#888888' } },
        xAxis: { type: 'datetime', title: { text: 'Time' } },
        yAxis: [
          { title: { text: 'Magnitude' }, min: 0, gridLineColor: '#888888', gridLineDashStyle: 'Dot' },
          { title: { text: 'Nb events/day' }, opposite: true, gridLineColor: '#888888', gridLineDashStyle: 'Dot' }
        ],
        legend: { enabled: false },
        plotOptions: {
          column: { pointPlacement: 'between', groupPadding: 0, pointPadding: 0, states: { inactive: { opacity: 1 } }, borderColor: 'transparent' },
          scatter: { states: { inactive: { opacity: 1 } } }
        },
        series: [{
          name: 'Nb events/day',
          type: 'column',
          color: 'rgb(103 125 147 / 50%)',
          yAxis: 1,
          states: { hover: { brightness: -0.1 } },
          data: eventsPerDay,
          pointPadding: 0.1
        }, {
          name: 'Events',
          type: 'scatter',
          color: 'black',
          turboThreshold: 0,
          data: scatterMag,
          tooltip: {
            headerFormat: '',
            pointFormatter: function () {
              return [
                `<strong>${new Date(this.x).toISOString().replace('T', ' ').slice(0, 19)}</strong>`,
                `Magnitude: ${this.y!.toFixed(1)}`,
                `<em>${this.name}</em>`
              ].join('<br>')
            }
          }
        }]
      })
      const eventsWithMag = events.filter(e => e.mag != null)
      const allMag = [...new Set(eventsWithMag.map(event => event.mag))] as number[]
      allMag.sort()
      const data = []
      for (const mag of allMag) {
        data.push([
          mag,
          eventsWithMag.filter(e => e.mag! >= mag).length
        ])
      }
      Highcharts.chart({
        title: { text: 'Gutenberg-Richter', style: { color: '#888888' } },
        chart: { backgroundColor: 'transparent', renderTo: grContainer },
        xAxis: { title: { text: 'Magnitudes' } },
        yAxis: {
          title: { text: 'Nb events' },
          min: 1,
          type: 'logarithmic',
          gridLineColor: '#888888',
          gridLineDashStyle: 'Dot'
        },
        legend: { enabled: false },
        tooltip: {
          formatter: function () {
            const x = this.x as number
            return [
              `Magnitude: ${x.toFixed(1)}`,
              `Nb events: ${this.y}`
            ].join('<br/>')
          }
        },
        plotOptions: {
          series: {
            marker: {
              lineWidth: 1,
              lineColor: '#7cb5ec',
              fillColor: 'transparent',
              radius: 2
            }
          }
        },
        series: [{
          type: 'scatter',
          name: 'Nb events',
          data
        }]
      })
    }

  }
})
</script>

<style lang="css">
.selected-event-row {
  background-color: #e7f9ff !important;
}
.v-application.theme--dark .selected-event-row {
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
.v-application.theme--dark .list-view__map-table th {background-color: #272727;}
</style>
