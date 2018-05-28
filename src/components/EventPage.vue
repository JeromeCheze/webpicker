<template>
  <div>
    <el-row>
      <h4>{{ this.event.description.text }}</h4>
    </el-row>
    <el-row>
      <el-col :span="8">
        <div class="map-canvas"></div>
      </el-col>
      <el-col :span="6">
        <table class="event-description">
          <tbody>
            <tr><th>Time</th><td colspan="2">{{ displayedOrigin.time.pretty }}</td></tr>
            <tr><th>Depth</th><td>{{ displayedOrigin.depth.pretty }}</td><td>{{ displayedOrigin.depth.prettyUncertainty }}</td></tr>
            <tr><th>Lat</th><td>{{ displayedOrigin.latitude.pretty }}</td><td>{{ displayedOrigin.latitude.prettyUncertainty }}</td></tr>
            <tr><th>Lon</th><td>{{ displayedOrigin.longitude.pretty }}</td><td>{{ displayedOrigin.longitude.prettyUncertainty }}</td></tr>
            <tr><th>Phases</th><td colspan="2">{{ displayedOrigin.quality.usedPhaseCount }} / {{ displayedOrigin.quality.associatedPhaseCount }}</td></tr>
            <tr><th>RMS Res</th><td colspan="2">{{ displayedOrigin.quality.standardError.toFixed(2) }}</td></tr>
            <tr><th>Az. Gap</th><td colspan="2">{{ displayedOrigin.quality.azimuthalGap.toFixed(0) }} °</td></tr>
            <tr><th>Min. Dist</th><td colspan="2">{{ displayedOrigin.quality.minimumDistance.toFixed(2) }} °</td></tr>
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
        ref="arrivalTable"
        :data="arrivalTableData"
        :default-sort="{ prop: 'distance', order: 'ascending' }"
        row-key="id"
        :height="500"
        style="width: 100%">
        <el-table-column type="selection" min-width="55" reserve-selection></el-table-column>
        <el-table-column min-width="70" prop="status" label="Status"></el-table-column>
        <el-table-column min-width="90" prop="phase" label="Phase"></el-table-column>
        <el-table-column min-width="70" prop="network" label="Net"></el-table-column>
        <el-table-column min-width="100" prop="station" label="Sta"></el-table-column>
        <el-table-column min-width="120" prop="loccha" label="Loc/Cha"></el-table-column>
        <el-table-column min-width="70" prop="residual" label="Res" :formatter="floatFormatter" sortable></el-table-column>
        <el-table-column min-width="90" prop="distance" label="Dist" :formatter="floatFormatter" sortable></el-table-column>
        <el-table-column min-width="90" prop="azimuth" label="Az" :formatter="floatFormatter" sortable></el-table-column>
        <el-table-column min-width="130" prop="time" label="Time" :formatter="timeFormatter" sortable></el-table-column>
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
      dirty: true,
      map: null,
      markers: [],
      displayedOrigin: this.event.po,
      displayedMagnitude: this.event.pm,
      chart: {
        timeResidual: null,
        travelTime: null,
        Azimuth: null
      },
      arrivalTableData: [],
      activeChartTab: 'timeResidual'
    }
  },
  watch: {
    event: function(val) {
      this.dirty = true
    }
  },
  activated () {
    if (this.dirty) {
      this.dirty = false
      this.setOrigin(this.event.po)
    }
  },
  methods: {
    floatFormatter (row, col) {
      return row[col.property].toFixed(2)
    },
    timeFormatter (row, col) {
      return row[col.property].toISOString().split('T')[1].substr(0, 12)
    },
    updateArrivalTableData () {
      let data = this.displayedOrigin.arrival.map(a => ({
        id: a.id,
        used: a.used,
        status: a.pick.evaluationMode == 'automatic' ? 'A' : 'M',
        phase: a.phase,
        network: a.pick.waveformID.$networkCode,
        station: a.pick.waveformID.$stationCode,
        loccha: `${a.pick.waveformID.$locationCode}.${a.pick.waveformID.$channelCode}`,
        residual: a.timeResidual,
        distance: a.distance,
        azimuth: a.azimuth,
        time: a.time
      }))
      this.$set(this, 'arrivalTableData', data)
    },
    setOrigin (o) {
      this.$emit('origin', o)
      this.displayedOrigin = o
      this.updateArrivalTableData()
      this.eventMap()
      this.initChartsData()
      this.initChartTimeResidual()
      for (let row of this.arrivalTableData) {
        this.$refs.arrivalTable.toggleRowSelection(row, row.used)
      }
    },
    initMap () {
      let map = L.map(this.$el.querySelector('.map-canvas'), {trackResize: false, attributionControl: false})
      let worldtopomap = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, HERE, DeLorme, TomTom, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, <br>Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), swisstopo, MapmyIndia, © OpenStreetMap contributors, and the GIS User Community'
      })
      worldtopomap.addTo(map)
      L.control.scale({ imperial: false }).addTo(map)
      this.map = map
    },
    getStationCoordinates (wfid) {
      if (this.inventory[wfid.$networkCode] != null &&
          this.inventory[wfid.$networkCode][wfid.$stationCode] != null) {
        let sta = this.inventory[wfid.$networkCode][wfid.$stationCode]
        return [sta.lat, sta.lon]
      }
      return null
    },
    initChartsData () {
      this.chart.timeResidual = { p: [], s: [] }
      this.chart.travelTime = { p: [], s: [] }
      for (let a of this.displayedOrigin.arrival) {
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
      } else {
        this.map.invalidateSize()
      }
      for (let m of this.markers) {
        m.remove()
      }
      this.markers = []
      this.displayedOrigin.latlng = L.latLng([
        this.displayedOrigin.latitude.value,
        this.displayedOrigin.longitude.value
      ])
      let bounds = [this.displayedOrigin.latlng]
      for (let a of this.displayedOrigin.arrival) {
        let wfid = a.pick.waveformID
        let pos = this.getStationCoordinates(wfid)
        if (pos == null) {
          console.warn(`No coordinates found for channel ${a.pick.seedid}`)
          continue
        }
        bounds.push(pos)
        if (a.used) {
          this.markers.push(L.polyline([this.displayedOrigin.latlng, pos], {
            color: 'gray',
            weight: 1
          }).addTo(this.map))
        }
        this.markers.push(L.circleMarker(pos, {
          radius: 2,
          weight: 1,
          color: a.used ? 'black' : 'gray',
          fillOpacity: 1
        }).bindPopup(a.pick.seedid).addTo(this.map))
      }
      this.markers.push(L.circleMarker(this.displayedOrigin.latlng, {
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
