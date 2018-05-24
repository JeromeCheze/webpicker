<template>
  <div>
    <el-row>
      <el-col :span="8">
        <div class="map-canvas"></div>
      </el-col>
      <el-col :span="6">
        <table class="event-description">
          <tbody>
            <tr><th>Time</th><td>{{ event.po.time.pretty }}</td></tr>
            <tr><th>Depth</th><td>{{ event.po.depth.pretty }} {{ event.po.depth.prettyUncertainty }}</td></tr>
            <tr><th>Lat</th><td>{{ event.po.latitude.pretty }} {{ event.po.latitude.prettyUncertainty }}</td></tr>
            <tr><th>Lon</th><td>{{ event.po.longitude.pretty }} {{ event.po.longitude.prettyUncertainty }}</td></tr>
            <tr><th>Phases</th><td>{{ event.po.quality.usedPhaseCount }} / {{ event.po.quality.associatedPhaseCount }}</td></tr>
            <tr><th>RMS Res</th><td>{{ event.po.quality.standardError.toFixed(2) }}</td></tr>
            <tr><th>Az. Gap</th><td>{{ event.po.quality.azimuthalGap.toFixed(0) }} °</td></tr>
            <tr><th>Min. Dist</th><td>{{ event.po.quality.minimumDistance.toFixed(2) }} °</td></tr>
          </tbody>
        </table>
      </el-col>
      <el-col :span="10">
        <el-tabs v-model="activeChartTab" type="card" @tab-click="handleChartChange">
          <el-tab-pane name="timeResidual" label="Time residual"><div class="chart-time-residual"></div></el-tab-pane>
          <el-tab-pane name="travelTime" label="Travel time"><div class="chart-travel-time"></div></el-tab-pane>
          <el-tab-pane name="azimuth" label="Azimuth"><div class="chart-azimuth"></div></el-tab-pane>
        </el-tabs>
      </el-col>
    </el-row>
    <el-row>
      <el-table
        :data="arrivalTableData"
        :default-sort="{ prop: 'distance', order: 'ascending' }"
        :height="500"
        style="width: 100%"
        v-if="usedArrivalLoaded">
        <el-table-column width="90" prop="used" label="Used">
          <template scope="scope">
            <el-checkbox v-model="usedArrival[scope.row.id]"></el-checkbox>
          </template>
        </el-table-column>
        <el-table-column min-width="70" prop="status" label="Status"></el-table-column>
        <el-table-column min-width="90" prop="phase" label="Phase"></el-table-column>
        <el-table-column min-width="70" prop="network" label="Net"></el-table-column>
        <el-table-column min-width="100" prop="station" label="Sta"></el-table-column>
        <el-table-column min-width="120" prop="loccha" label="Loc/Cha"></el-table-column>
        <el-table-column min-width="70" prop="residual" label="Res" sortable></el-table-column>
        <el-table-column min-width="90" prop="distance" label="Dist" sortable></el-table-column>
        <el-table-column min-width="90" prop="azimuth" label="Az" sortable></el-table-column>
        <el-table-column min-width="130" prop="time" label="Time" sortable></el-table-column>
      </el-table>
    </el-row>
  </div>
</template>

<script>
import Highcharts from 'highcharts'
import addMore from 'highcharts/highcharts-more'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

addMore(Highcharts)

export default {
  props: {
    event: { required: true },
    inventory: { required: true }
  },
  data () {
    return {
      map: null,
      markers: [],
      usedArrivalLoaded: false,
      usedArrival: {},
      chart: {
        timeResidual: null,
        travelTime: null,
        Azimuth: null
      },
      activeChartTab: 'timeResidual'
    }
  },
  mounted () {
    this.eventMap()
    this.initUsedArrival()
    this.initChartsData()
  },
  computed: {
    arrivalTableData () {
      return this.event.po.arrival.map(a => ({
        id: a.id,
        used: a.used,
        status: a.pick.evaluationMode == 'automatic' ? 'A' : 'M',
        phase: a.phase,
        network: a.pick.waveformID.$networkCode,
        station: a.pick.waveformID.$stationCode,
        loccha: `${a.pick.waveformID.$locationCode}.${a.pick.waveformID.$channelCode}`,
        residual: a.timeResidual.toFixed(2),
        distance: a.distance.toFixed(2),
        azimuth: a.azimuth.toFixed(2),
        time: a.time.toISOString().split('T')[1].substr(0, 12)
      }))
    }
  },
  methods: {
    initMap () {
      let map = L.map(this.$el.querySelector('.map-canvas'), {attributionControl: false})
      let worldtopomap = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, HERE, DeLorme, TomTom, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, <br>Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), swisstopo, MapmyIndia, © OpenStreetMap contributors, and the GIS User Community'
      })
      worldtopomap.addTo(map)
      L.control.scale({ imperial: false }).addTo(map)
      this.map = map
    },
    getStationCoordinates (wfid) {
      let sta = this.inventory[wfid.$networkCode][wfid.$stationCode]
      return [sta.lat, sta.lon]
    },
    initUsedArrival () {
      this.usedArrivalLoaded = false
      this.usedArrival = {}
      for (let a of this.event.po.arrival) {
        this.$set(this.usedArrival, a.id, a.used)
        // this.usedPick[a.pickID] = a.used
      }
      this.usedArrivalLoaded = true
    },
    initChartsData () {
      this.chart.timeResidual = { p: [], s: [] }
      this.chart.travelTime = { p: [], s: [] }
      for (let a of this.event.po.arrival) {
        let serie = (a.phase == 'P' ? 'p' : 's')
        let color = (a.timeWeight < .5 ? 'gray' : a.pick.evaluationMode == 'automatic' ? 'red' : 'green')
        this.chart.timeResidual[serie].push({
          x: a.distance, y: a.timeResidual, name: a.pick.seedid, color: color
        })
        this.chart.travelTime[serie].push({
          x: a.distance, y: a.time.getTime()/1000., name: a.pick.seedid, color: color
        })
      }
    },
    eventMap () {
      if (this.map == null) {
        this.initMap()
      }
      for (let m of this.markers) {
        m.remove()
      }
      this.markers = []
      this.event.po.latlng = L.latLng([
        this.event.po.latitude.value,
        this.event.po.longitude.value
      ])
      let bounds = [this.event.po.latlng]
      for (let a of this.event.po.arrival) {
        let wfid = a.pick.waveformID
        let pos = this.getStationCoordinates(wfid)
        bounds.push(pos)
        this.markers.push(L.polyline([this.event.po.latlng, pos], {
          color: 'gray',
          weight: 1
        }).addTo(this.map))
        this.markers.push(L.circleMarker(pos, {
          radius: 2,
          weight: 1,
          color: 'black',
          fillOpacity: 1
        }).bindPopup(a.pick.seedid).addTo(this.map))
      }
      this.markers.push(L.circleMarker(this.event.po.latlng, {
        radius: 8,
        weight: 1,
        color: 'red',
        fillOpacity: .8
      }).addTo(this.map))
      this.map.fitBounds(bounds)
    },
    initChartTimeResidual () {
      let container = this.$el.querySelector('.chart-time-residual')
      Highcharts.chart({
        chart: { renderTo: container, type: 'scatter' },
        title: { text: 'Time residual/Distance' },
        xAxis: { title: { text: 'Distance [°]' } },
        yAxis: { title: { text: 'Time residual [s]' } },
        series: [
          { name: 'P', data: this.chart.timeResidual.p },
          { name: 'S', data: this.chart.timeResidual.s }
        ]
      })
    },
    initChartTravelTime () {
      let container = this.$el.querySelector('.chart-travel-time')
      Highcharts.chart({
        chart: { renderTo: container, type: 'scatter' },
        title: { text: 'Travel time/Distance' },
        xAxis: { title: { text: 'Distance [°]' } },
        yAxis: { title: { text: 'Travel time [s]' } },
        series: [
          { name: 'P', data: this.chart.travelTime.p },
          { name: 'S', data: this.chart.travelTime.s }
        ]
      })
    },
    initChartAzimuth () {},
    handleChartChange (tab, ev) {
      if (tab.name == 'timeResidual') {
        this.initChartTimeResidual()
      } else if (tab.name == 'travelTime') {
        this.initChartTravelTime()
      } else if (tab.name == 'azimuth') {
        this.initChartAzimuth()
      }
    }
  }
}
</script>

<style>
.map-canvas {height: 400px;}
.event-description {margin: 20px; font-size: .9em;}
.event-description th, .event-description td {padding: 3px;}
.event-description th {text-align: right; padding-right: 10px;}
</style>
