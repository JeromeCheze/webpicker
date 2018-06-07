<template>
  <div v-loading="loading">
    <el-row class="toolbar" type="flex" align="middle">
      <el-form :inline="true">
        <el-form-item>
          <el-button icon="el-icon-location" @click="handleLocateClick">Locate</el-button>
        </el-form-item>
      </el-form>
    </el-row>
    <el-row>
      <h4>
        <el-tag type="warning" v-if="origin.uncommitted">
          <i class="el-icon-warning"></i>
          Not committed
        </el-tag>
        {{ this.event.description.text }}
      </h4>
    </el-row>
    <el-row>
      <el-col :span="8">
        <div class="map-canvas" style="height: 400px;"></div>
      </el-col>
      <el-col :span="6">
        <table class="event-description">
          <tbody>
            <tr><th>Time</th><td colspan="2">{{ origin.time.pretty }}</td></tr>
            <tr><th>Depth</th><td>{{ origin.depth.pretty }}</td><td>{{ origin.depth.prettyUncertainty }}</td></tr>
            <tr><th>Lat</th><td>{{ origin.latitude.pretty }}</td><td>{{ origin.latitude.prettyUncertainty }}</td></tr>
            <tr><th>Lon</th><td>{{ origin.longitude.pretty }}</td><td>{{ origin.longitude.prettyUncertainty }}</td></tr>
            <tr><th>Phases</th><td colspan="2">{{ origin.quality.usedPhaseCount }} / {{ origin.quality.associatedPhaseCount }}</td></tr>
            <tr><th>RMS Res</th><td colspan="2">{{ origin.quality.standardError.toFixed(2) }}</td></tr>
            <tr><th>Az. Gap</th><td colspan="2">{{ origin.quality.azimuthalGap.toFixed(0) }} °</td></tr>
            <tr><th>Min. Dist</th><td colspan="2">{{ origin.quality.minimumDistance.toFixed(2) }} °</td></tr>
          </tbody>
        </table>
      </el-col>
      <el-col :span="10">
        <el-tabs v-model="activeChartTab" @tab-click="handleChartChange">
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
        @selection-change="handleSelectionChange"
        style="width: 100%">
        <el-table-column type="selection" min-width="55" reserve-selection></el-table-column>
        <el-table-column min-width="70" prop="mode" label="Status">
          <template slot-scope="scope">
            <el-tag :type="scope.row.modeColor">{{ scope.row.mode }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column min-width="90" prop="phase" label="Phase"></el-table-column>
        <el-table-column min-width="70" prop="network" label="Net"></el-table-column>
        <el-table-column min-width="100" prop="station" label="Sta"></el-table-column>
        <el-table-column min-width="120" prop="loccha" label="Loc/Cha"></el-table-column>
        <el-table-column min-width="100" prop="polarity" label="Polarity"></el-table-column>
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
import utils from './../utils/utils.js'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

addMore(Highcharts)

let handleChartSelection = function(ev) {
  let [x, y] = [ev.xAxis[0], ev.yAxis[0]]
  let selectedPickIDs = []
  for (let s of this.series) {
    for (let p of s.points) {
      if (p.x >= x.min && p.x <= x.max && p.y >= y.min && p.y <= y.max) {
        selectedPickIDs.push(p.id)
      }
    }
  }
  Highcharts.fireEvent(this, 'selectedpoints', selectedPickIDs)
  return false
}

export default {
  props: {
    event: { required: true },
    origin: { required: true },
    inventory: { required: true }
  },

  data () {
    return {
      dirty: true,
      loading: false,
      updating: false,
      map: null,
      markers: [],
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
    },
    origin: function(val) {
      this.dirty = true
    }
  },

  activated () {
    if (this.dirty) {
      this.dirty = false
      this.updateAll()
    }
  },

  methods: {
    floatFormatter (row, col) {
      return row[col.property].toFixed(2)
    },

    timeFormatter (row, col) {
      return row[col.property].toISOString().split('T')[1].substr(0, 12)
    },

    setSelectedArrival (selectedPickIDs) {
      for (let a of this.origin.arrival) {
        a.timeWeight = selectedPickIDs.indexOf(a.pickID) >= 0 ? 1 : 0
      }
      this.updateAll()
    },

    handleSelectionChange (selectedRows) {
      if (this.updating) return
      this.setSelectedArrival(selectedRows.map(x => x.id))
    },

    updateArrivalTableData () {
      let data = this.origin.arrival.map(a => ({
        id: a.pickID,
        mode: a.pick.evaluationMode == 'automatic' ? 'A' : 'M',
        modeColor: a.pick.evaluationMode == 'manual' ? 'success' : 'danger',
        phase: a.phase,
        network: a.pick.waveformID.$networkCode,
        station: a.pick.waveformID.$stationCode,
        loccha: `${a.pick.waveformID.$locationCode}.${a.pick.waveformID.$channelCode}`,
        polarity: a.pick.polarity != null ? a.pick.polarity : '',
        residual: a.timeResidual,
        distance: a.distance,
        azimuth: a.azimuth,
        time: a.time,
        weight: a.timeWeight
      }))
      this.$set(this, 'arrivalTableData', data)
    },

    updateAll () {
      this.updating = true
      this.updateArrivalTableData()
      this.eventMap()
      this.initChartsData()
      this.initChartTimeResidual()
      this.$refs.arrivalTable.clearSelection()
      for (let row of this.arrivalTableData) {
        this.$refs.arrivalTable.toggleRowSelection(row, row.weight == 1)
      }
      this.updating = false
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
      this.origin.latlng = L.latLng([
        this.origin.latitude.value,
        this.origin.longitude.value
      ])
      let bounds = [this.origin.latlng]
      for (let a of this.origin.arrival) {
        let wfid = a.pick.waveformID
        let pos = this.getStationCoordinates(wfid)
        if (pos == null) {
          console.warn(`No coordinates found for channel ${a.pick.seedid}`)
          continue
        }
        bounds.push(pos)
        if (a.timeWeight == 1) {
          this.markers.push(L.polyline([this.origin.latlng, pos], {
            color: 'gray',
            weight: 1
          }).addTo(this.map))
        }
        this.markers.push(L.circleMarker(pos, {
          radius: 2,
          weight: 1,
          color: a.timeWeight == 1 ? 'black' : 'gray',
          fillOpacity: 1
        }).bindPopup(a.pick.seedid).addTo(this.map))
      }
      this.markers.push(L.circleMarker(this.origin.latlng, {
        radius: 8,
        weight: 1,
        color: 'red',
        fillOpacity: .8
      }).addTo(this.map))
      this.map.fitBounds(bounds)
    },

    initChartsData () {
      this.chart.timeResidual = { p: [], s: [] }
      this.chart.travelTime = { p: [], s: [] }
      for (let a of this.origin.arrival) {
        let serie = (a.phase == 'P' ? 'p' : 's')
        let color = (
          a.timeWeight < .5 ? 'gray' :
          a.pick.evaluationMode == 'automatic' ? 'red' :
          'green'
        )
        this.chart.timeResidual[serie].push({
          x: a.distance, y: a.timeResidual, name: a.pick.seedid, color: color, id: a.pickID
        })
        this.chart.travelTime[serie].push({
          x: a.distance, y: a.time.getTime()/1000., name: a.pick.seedid, color: color, id: a.pickID
        })
      }
    },

    initChartTimeResidual () {
      let extreme = 1 + Math.floor(
        Math.abs(
          Math.max.apply(null,
            this.chart.timeResidual.p.concat(this.chart.timeResidual.s).map(x => x.y)
          )
        )
      )
      let container = this.$el.querySelector('.chart-time-residual')
      Highcharts.chart({
        chart: { renderTo: container, type: 'scatter', zoomType: 'xy', events: {
          selection: handleChartSelection,
          selectedpoints: selectedPickIDs => this.setSelectedArrival(selectedPickIDs)
        } },
        title: { text: 'Time residual/Distance' },
        xAxis: { title: { text: 'Distance [°]' } },
        yAxis: { title: { text: 'Time residual [s]' }, min: -1 * extreme, max: extreme },
        tooltip: { formatter: function() {
          return `<b>${this.point.name}</b><br>Distance: ${this.x.toFixed(2)} km<br>Residual: ${this.y.toFixed(2)} s`
        } },
        plotOptions: { series: { animation: false } },
        series: [
          { name: 'P', data: this.chart.timeResidual.p },
          { name: 'S', data: this.chart.timeResidual.s }
        ]
      })
    },

    initChartTravelTime () {
      let container = this.$el.querySelector('.chart-travel-time')
      Highcharts.chart({
        chart: { renderTo: container, type: 'scatter', zoomType: 'xy', events: {
          selection: handleChartSelection,
          selectedpoints: selectedPickIDs => this.setSelectedArrival(selectedPickIDs)
        } },
        title: { text: 'Travel time/Distance' },
        xAxis: { title: { text: 'Distance [°]' } },
        yAxis: { title: { text: 'Travel time [s]' } },
        tooltip: { formatter: function() {
          return `<b>${this.point.name}</b><br>Distance: ${this.x.toFixed(2)} km<br>Time: ${this.y.toFixed(2)} s`
        } },
        plotOptions: { series: { animation: false } },
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
    },

    handleLocateClick () {
      this.loading = true
      let jquake = utils.toJquake(this.event.$publicID, this.origin)
      utils.ajax({
        method: 'POST',
        url: 'locate',
        type: 'json',
        dataMimeType: 'application/json',
        data: JSON.stringify(jquake),
      }).then(data => {
        this.loading = false
        if (data.message != '') {
          this.$notify.error({ message: data.message })
        } else {
          let parser = new DOMParser()
          let qml = parser.parseFromString(data.quakeml, 'application/xml')
          console.log(qml);
          let e = utils.xmlNodeToJson(
            qml.getElementsByTagName('eventParameters')[0],
            '',
            utils.CONVERSION_RULES
          ).event[0]
          utils.processEventData(e)
          console.log(e);
          let o = e.origin[0]
          Object.assign(this.origin, {
            time: o.time,
            latitude: o.latitude,
            longitude: o.longitude,
            evaluationMode: 'manual',
            depth: o.depth,
            originUncertainty: o.originUncertainty,
            creationInfo: o.creationInfo
          })
          Object.assign(this.origin.quality, {
            associatedPhaseCount: this.origin.arrival.length,
            usedPhaseCount: o.arrival.length,
            standardError: o.quality.standardError,
          })
          for (let newA of o.arrival) {
            let a = this.origin.arrival.find(x => x.pickID == newA.pickID)
            Object.assign(a, {
              azimuth: newA.azimuth,
              distance: newA.distance,
              timeResidual: newA.timeResidual
            })
          }
          this.updateAll()
        }
      })
    }
  }
}
</script>

<style>
.event-description {margin: 20px; font-size: .9em;}
.event-description th, .event-description td {padding: 3px;}
.event-description th {text-align: right; padding-right: 10px;}
</style>
