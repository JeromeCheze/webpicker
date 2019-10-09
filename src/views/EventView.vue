<template>
  <v-card v-if="event != null && origin != null" class="pt-3 px-3 pb-5">

    <event-tools @need-update="updateAll" @need-init="initEvent"></event-tools>

    <event-description @need-update="updateAll"></event-description>

    <v-layout>
      <v-flex xs12 md4>
        <div class="event-view__map-canvas" :style="{ height: '400px', zIndex: 1 }"></div>
      </v-flex>
      <v-flex xs12 md8 class="event-view__chart-container">
        <v-tabs v-model="activeChartTab" @change="handleChartChange" right>
          <v-tab>Time residual</v-tab>
          <v-tab>Travel time</v-tab>
          <v-tab-item class="event-view__chart--time-residual"></v-tab-item>
          <v-tab-item class="event-view__chart--travel-time"></v-tab-item>
        </v-tabs>
      </v-flex>
    </v-layout>

    <v-data-table
      v-model="arrivalTableSelected"
      :headers="arrivalTableHeader"
      :items="arrivalTableData"
      :pagination.sync="arrivalTablePagination"
      @input="handleSelectionChange"
      item-key="id"
      select-all>
      <template v-slot:items="props">
        <tr @click="handleRowClick(props.item)">
          <td><v-checkbox v-model="props.selected" primary hide-details></v-checkbox></td>
          <td><v-chip label outline small :color="props.item.modeColor">{{ props.item.mode }}</v-chip></td>
          <td>{{ props.item.phase }}</td>
          <td>{{ props.item.network }}</td>
          <td>{{ props.item.station }}</td>
          <td>{{ props.item.loccha }}</td>
          <td>{{ props.item.takeoffAngle }}</td>
          <td>{{ props.item.polarity }}</td>
          <td>{{ floatFormatter(props.item.residual) }}</td>
          <td>{{ floatFormatter(props.item.distance) }}</td>
          <td>{{ floatFormatter(props.item.azimuth) }}</td>
          <td>{{ floatFormatter(props.item.weight) }}</td>
          <td>{{ timeFormatter(props.item.time) }}</td>
        </tr>
      </template>
    </v-data-table>
  </v-card>
</template>

<script>
import Highcharts from 'highcharts'
import addMore from 'highcharts/highcharts-more'
import utils from './../utils/utils.js'
import L from 'leaflet'
import 'leaflet-ellipse'

addMore(Highcharts)

let handleChartSelection = function(ev, manualOnly=false) {
  let [x, y] = [ev.xAxis[0], ev.yAxis[0]]
  let selectedPickIDs = []
  for (let s of this.series) {
    for (let p of s.points) {
      if (manualOnly && p.manual || !manualOnly) {
        if (p.x >= x.min && p.x <= x.max && p.y >= y.min && p.y <= y.max) {
          selectedPickIDs.push(p.id)
        }
      }
    }
  }
  Highcharts.fireEvent(this, 'selectedpoints', selectedPickIDs)
  return false
}

export default {

  props: ['code'],
  // props: {
  //   event: { required: true },
  //   origin: { required: true },
  //   inventory: { required: true }
  // },

  data () {
    return {
      dirty: true,
      updating: false,
      map: null,
      layers: [],

      arrivalTableHeader: [
        { text: 'Status', value: 'mode', sortable: false },
        { text: 'Phase', value: 'phase', sortable: false },
        { text: 'Net', value: 'network', sortable: false },
        { text: 'Sta', value: 'station', sortable: false },
        { text: 'Loc/Cha', value: 'loccha', sortable: false },
        { text: 'Takeoff [°]', value: 'takeoffAngle', sortable: false },
        { text: 'Polarity', value: 'polarity', sortable: false },
        { text: 'Res', value: 'residual' },
        { text: 'Dist', value: 'distance' },
        { text: 'Az', value: 'azimuth' },
        { text: 'Weight', value: 'weight' },
        { text: 'Time', value: 'time' }
      ],
      arrivalTableData: [],
      arrivalTableSelected: [],
      arrivalTablePagination: {
        descending: false,
        page: 1,
        rowsPerPage: -1,
        sortBy: 'distance',
        totalItems: null
      },

      activeChartTab: 0,
      chart: {
        timeResidual: null,
        travelTime: null
      },
      shiftPressed: false,
      keyHandlersBinded: false,
      eventHandler: {
        'keydown': ev => this.handleKeydown(ev),
        'keyup': ev => this.handleKeyup(ev),
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
    inventory () {
      return this.$store.state.inventory
    }
  },

  // watch: {
  //   event: function(val) {
  //     this.dirty = true
  //   },
  //   origin: function(val) {
  //     this.dirty = true
  //   }
  // },

  mounted () {
    if (this.event == null || this.event.public_id != this.code) {
      this.initEvent()
    } else {
      this.updateAll()
    }
    if (!this.keyHandlersBinded) {
      this.keyHandlersBinded = true
      for (let [name, handler] of Object.entries(this.eventHandler)) {
        document.body.addEventListener(name, handler)
      }
    }
  },

  beforeDestroy () {
    if (this.keyHandlersBinded) {
      this.keyHandlersBinded = false
      for (let [name, handler] of Object.entries(this.eventHandler)) {
        document.body.removeEventListener(name, handler)
      }
    }
  },

  methods: {

    handleKeydown (ev) {
      if (ev.key == 'Shift') {
        this.shiftPressed = true
      }
    },

    handleKeyup (ev) {
      if (ev.key == 'Shift') {
        this.shiftPressed = false
      }
    },

    initEvent () {
      this.$store.dispatch('setLoading', { value: true, text: 'Loading event description...' })
      utils.ajax({
        method: 'GET',
        url: this.$store.getters.getLink('fdsnws/event/1/query'),
        args: {
          format: 'xml',
          eventid: this.code,
          includeallorigins: 'true',
          includeallmagnitudes: 'true',
          includearrivals: 'true',

          // Non-standard argument handled by site_routage.
          // It used to get event description from scxmldump (if possible)
          // instead of requesting the regular FDSNWS. So that the amplitude and
          // the station magnitude are retrieved, which is not the case from FDSNWS.
          fulldescription: 'true'
        },
        type: 'document'
      }).then(qml => {
        let e = utils.parseQuakeML(qml)[0]
        console.log('[EventView::initEvent] full description event', e);
        let chList = []
        for (let o of e.origin) {
          for (let a of o.arrival) {
            let ch = a._pick._fdsnid.split('.').slice(0, 3).concat(['*']).join(' ')
            if (chList.indexOf(ch) < 0) {
              chList.push(ch)
            }
          }
        }
        let t = e._po.time.value.slice(0, 19)
        this.$store.dispatch('setLoading', { value: true, text: 'Loading inventory...' })
        utils.ajax({
          method: 'POST',
          url: this.$store.getters.getLink('fdsnws/station/1/query'),
          dataMimeType: 'text/plain',
          data: [
            'level=channel',
            'format=text'
          ].concat(chList.map(ch => `${ch} ${t} ${t}`)).join('\r\n'),
          type: 'text'
        }).then(data => {
          this.$store.dispatch('setInventory', utils.parseInventory(data))
          this.$store.dispatch('setCurrentEvent', e)
          this.$nextTick(function () {
            this.updateAll()
            this.$store.dispatch('setLoading', { value: false })
          })
        })
      })
    },

    floatFormatter (value) {
      return value == null ? '' : value.toFixed(2)
    },

    timeFormatter (value) {
      // return value.toISOString().split('T')[1].substr(0, 12)
      return value.toISOString().split('T')[1].substr(0, 8)
    },

    setSelectedArrival (selectedPickIDs) {
      for (let a of this.origin.arrival) {
        a.time_weight = selectedPickIDs.indexOf(a.pick_id) >= 0 ? 1 : 0
      }
      this.updateAll()
    },

    handleSelectionChange (selectedRows) {
      if (this.updating) return
      this.setSelectedArrival(selectedRows.map(x => x.id))
    },

    updateArrivalTableData () {
      this.arrivalTablePagination.totalItems = this.origin.arrival.length
      this.arrivalTableData = this.origin.arrival.map(a => ({
        id: a._pick.public_id,
        mode: a._pick.evaluation_mode == 'automatic' ? 'A' : 'M',
        modeColor: a._pick.evaluation_mode == 'manual' ? 'green' : 'red',
        phase: a.phase,
        network: a._pick.waveform_id.network_code,
        station: a._pick.waveform_id.station_code,
        loccha: a._pick._fdsnid.split('.').slice(-2).join('.'),
        takeoffAngle: a.takeoff_angle,
        polarity: a._pick.polarity != null ? a._pick.polarity : '',
        residual: a.time_residual,
        distance: a.distance,
        azimuth: a.azimuth,
        // time: a._traveltime,
        time: a._pick.time._value,
        weight: a.time_weight
      }))
    },

    updateAll () {
      // console.log(o == this.origin);
      // console.log('updateAll', this.origin);
      this.updating = true
      this.updateArrivalTableData()
      this.eventMap()
      this.initChartsData()
      if (this.activeChartTab == 0) {
        this.initChartTimeResidual()
      } else if (this.activeChartTab == 1) {
        this.initChartTravelTime()
      }
      this.arrivalTableSelected = []
      for (let row of this.arrivalTableData) {
        if (row.weight == 1) {
          this.arrivalTableSelected.push(row)
        }
      }
      this.dirty = false
      this.updating = false
    },

    initMap () {
      let map = L.map(this.$el.querySelector('.event-view__map-canvas'), {trackResize: false, attributionControl: false})
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
      this.map = map
    },

    getStationCoordinates (seedid) {
      let [n, s, l, c] = seedid.split('.')
      if (this.inventory[n] != null &&
          this.inventory[n][s] != null) {
        let sta = this.inventory[n][s]
        return [sta.lat, sta.lon]
      }
      return null
    },

    eventMap () {
      if (this.map == null) {
        this.initMap()
      }
      for (let l of Object.values(this.layers)) {
        l.remove()
      }
      this.layers = {}
      let originPos = L.latLng([
        this.origin.latitude.value,
        this.origin.longitude.value
      ])
      let bounds = [originPos]
      let arrivalPerStation = {}
      let maxRes = 0
      for (let a of this.origin.arrival) {
        let netsta = a._pick._seedid.split('.').slice(0, 2).join('.')
        if (a.time_weight > 0) {
          maxRes = Math.max(maxRes, Math.abs(a.time_residual))
        }
        let otherArr = arrivalPerStation[netsta]
        if (otherArr == null) {
          arrivalPerStation[netsta] = a
        } else {
          if (a.time_weight != 0 && (
                otherArr.time_weight == 0 ||
                Math.abs(a.time_residual) > Math.abs(otherArr.time_residual))) {
            arrivalPerStation[netsta] = a
          }
        }
      }
      utils.RESIDUAL_COLOR_SCALE[0][0] = -maxRes
      utils.RESIDUAL_COLOR_SCALE[2][0] = maxRes
      for (let [netsta, a] of Object.entries(arrivalPerStation)) {
        let pos = this.getStationCoordinates(a._pick._seedid)
        if (pos == null) {
          console.warn(`No coordinates found for channel ${a._pick._seedid}`)
          continue
        }
        bounds.push(pos)
        if (a.time_weight > 0) {
          this.layers[`${netsta}_line`] = L.polyline([originPos, pos], {
            color: 'gray',
            weight: 1
          }).addTo(this.map)
        }
        this.layers[netsta] = L.circleMarker(pos, {
          radius: 4,
          weight: 1,
          color: 'gray',
          fillColor: (
            a.time_weight > 0 ?
            utils.toRGB(utils.applyScale(a.time_residual, utils.RESIDUAL_COLOR_SCALE)) :
            'gray'
          ),
          fillOpacity: 1
        }).bindPopup(a._pick._seedid).addTo(this.map)
      }
      if (this.origin.longitude.uncertainty != null && this.origin.latitude.uncertainty != null) {
        this.layers['ellipse'] = L.ellipse(originPos, [
          this.origin.longitude.uncertainty * 1000,
          this.origin.latitude.uncertainty * 1000
        ], 0, {
          weight: 0,
          color: 'red',
          fillOpacity: .2
        }).addTo(this.map)
      }
      this.layers['epicenter'] = L.circleMarker(originPos, {
        radius: 8,
        weight: 1,
        color: 'red',
        fillOpacity: .8
      }).addTo(this.map)
      this.map.fitBounds(bounds)
      // console.log(this.origin);
    },

    initChartsData () {
      // console.log('initChartsData');
      this.chart.timeResidual = { p: [], s: [] }
      this.chart.travelTime = { p: [], s: [] }
      for (let a of this.origin.arrival) {
        let serie = (a.phase == 'P' ? 'p' : 's')
        let color = (
          a.time_weight < .5 ? 'gray' :
          a._pick.evaluation_mode == 'automatic' ? 'red' :
          'green'
        )
        this.chart.timeResidual[serie].push({
          x: a.distance, y: a.time_residual, name: a._pick._seedid, color: color, id: a.pick_id, manual: a._pick.evaluation_mode == 'manual'
        })
        this.chart.travelTime[serie].push({
          x: a.distance, y: a._traveltime.getTime()/1000., name: a._pick._seedid, color: color, id: a.pick_id, manual: a._pick.evaluation_mode == 'manual'
        })
      }
    },

    initChartTimeResidual () {
      let extreme = 1 + Math.floor(
        Math.max.apply(null,
          this.chart.timeResidual.p.concat(this.chart.timeResidual.s).map(x => Math.abs(x.y))
        )
      )
      let container = this.$el.querySelector('.event-view__chart--time-residual')
      let self = this
      Highcharts.chart({
        chart: { renderTo: container, type: 'scatter', zoomType: 'xy', events: {
          selection: function(ev) {return handleChartSelection.call(this, ev, self.shiftPressed)},
          selectedpoints: selectedPickIDs => this.setSelectedArrival(selectedPickIDs)
        } },
        title: { text: 'Time residual/Distance' },
        xAxis: { title: { text: 'Distance [°]' }, min: 0 },
        yAxis: { title: { text: 'Time residual [s]'}, min: -1 * extreme, max: extreme },
        tooltip: { formatter: function() {
          return `<b>${this.point.name}</b><br>Distance: ${this.x.toFixed(2)}°<br>Residual: ${this.y.toFixed(2)} s`
        } },
        plotOptions: { series: { animation: false } },
        series: [
          { name: 'P', data: this.chart.timeResidual.p },
          { name: 'S', data: this.chart.timeResidual.s }
        ]
      })
    },

    initChartTravelTime () {
      let container = this.$el.querySelector('.event-view__chart--travel-time')
      let self = this
      Highcharts.chart({
        chart: { renderTo: container, type: 'scatter', zoomType: 'xy', events: {
          selection: function(ev) {return handleChartSelection.call(this, ev, self.shiftPressed)},
          selectedpoints: selectedPickIDs => this.setSelectedArrival(selectedPickIDs)
        } },
        title: { text: 'Travel time/Distance' },
        xAxis: { title: { text: 'Distance [°]' }, min: 0 },
        yAxis: { title: { text: 'Travel time [s]' }, min: 0 },
        tooltip: { formatter: function() {
          return `<b>${this.point.name}</b><br>Distance: ${this.x.toFixed(2)}°<br>Time: ${this.y.toFixed(2)} s`
        } },
        plotOptions: { series: { animation: false } },
        series: [
          { name: 'P', data: this.chart.travelTime.p },
          { name: 'S', data: this.chart.travelTime.s }
        ]
      })
    },

    handleRowClick (row) {
      let netsta = `${row.network}.${row.station}`
      this.layers[netsta].openPopup()
    },

    handleChartChange (tab) {
      if (tab == 0) {
        this.initChartTimeResidual()
      } else if (tab == 1) {
        this.initChartTravelTime()
      }
    }

  }
}
</script>

<style lang="css">
.event-view__chart-container {padding-left: 20px;}
</style>
