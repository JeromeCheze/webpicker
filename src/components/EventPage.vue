<template>
  <div v-loading="loading">
    <el-row class="toolbar" type="flex" align="middle">
      <el-form :inline="true">
        <el-form-item>
          <el-button :type="relocateBtnType" icon="el-icon-location" @click="handleRelocateClick">Relocate</el-button>
        </el-form-item>
        <el-form-item>
          <el-button :type="magnitudeBtnType" @click="handleComputeMagnitudeClick">Compute magnitude</el-button>
        </el-form-item>
        <el-form-item>
          <el-popover placement="bottom" width="300" v-model="commitPopover">
            <el-form :model="commitForm">
              <el-form-item label="Event Type">
                <el-select v-model="commitForm.eventType">
                  <el-option
                    v-for="opt in commitForm.eventTypeOptions"
                    :key="opt"
                    :label="opt"
                    :value="opt"></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="Type certainty">
                <el-select v-model="commitForm.eventTypeCertainty">
                  <el-option
                    v-for="opt in commitForm.eventTypeCertaintyOptions"
                    :key="opt"
                    :label="opt"
                    :value="opt"></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="Origin status">
                <el-select v-model="commitForm.originEvaluationStatus">
                  <el-option
                    v-for="opt in commitForm.evaluationStatusOptions"
                    :key="opt"
                    :label="opt"
                    :value="opt"></el-option>
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button @click="commitPopover = false">Cancel</el-button>
                <el-button type="primary" @click="handleCommitClick">Commit</el-button>
              </el-form-item>
            </el-form>
            <el-button
              :type="origin._not_committed ? 'warning': null" slot="reference"
              @click="commitPopover = true">Commit</el-button>
          </el-popover>
        </el-form-item>
      </el-form>
    </el-row>
    <el-row>
      <h3>
        <el-tag type="warning" v-if="origin.uncommitted">
          <i class="el-icon-warning"></i>
          Not committed
        </el-tag>
        {{ this.event.description.text }}
      </h3>
    </el-row>
    <el-row>
      <strong>Magnitude</strong>
      <table class="event-description" v-if="magnitude != null">
        <thead>
          <th>Value</th><th>Magnitude type</th><th>Station count</th><th>Method</th>
        </thead>
        <tbody>
          <td>{{ magnitude.mag._pretty }}</td>
          <td>{{ magnitude.type }}</td>
          <td>{{ magnitude.station_count }}</td>
          <td>{{ magnitude._pretty_method }}</td>
        </tbody>
      </table>
      <div v-else>
        <el-alert type="danger" title="No magnitude selected"></el-alert>
      </div>
    </el-row>
    <el-row>
      <strong>Origin</strong>
      <table class="event-description">
        <thead>
          <th>Time</th><th>Latitude</th><th>Longitude</th><th>Depth</th><th>Phases</th><th>RMS</th><th>Az. Gap</th><th>Min Dist</th>
        </thead>
        <tbody>
          <td>{{ origin.time._pretty }}</td>
          <td>{{ origin.latitude._pretty }} {{ origin.latitude._pretty_uncertainty }}</td>
          <td>{{ origin.longitude._pretty }} {{ origin.longitude._pretty_uncertainty }}</td>
          <td>{{ origin.depth._pretty }} {{ origin.depth._pretty_uncertainty }}</td>
          <td>{{ origin.quality.used_phase_count }} / {{ origin.quality.associated_phase_count }}</td>
          <td>{{ origin.quality.standard_error.toFixed(2) }} s</td>
          <td>{{ origin.quality.azimuthal_gap.toFixed(0) }} °</td>
          <td>{{ origin.quality.minimum_distance.toFixed(2) }} °</td>
        </tbody>
      </table>
    </el-row>
    <el-row>
      <el-col :span="8">
        <div class="map-canvas" style="height: 400px;"></div>
      </el-col>
      <el-col :span="16" class="charts-container">
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
      commitForm: {
        eventType: 'earthquake',
        eventTypeCertainty: null,
        originEvaluationStatus: null,
        eventTypeCertaintyOptions: [
          'known',
          'suspected'
        ],
        evaluationStatusOptions: [
          'preliminary',
          'confirmed',
          'reviewed',
          'final',
          'rejected'
        ],
        eventTypeOptions: [
          'not existing',
          'not reported',
          'earthquake',
          'anthropogenic event',
          'collapse',
          'cavity collapse',
          'mine collapse',
          'building collapse',
          'explosion',
          'accidental explosion',
          'chemical explosion',
          'controlled explosion',
          'experimental explosion',
          'industrial explosion',
          'mining explosion',
          'quarry blast',
          'road cut',
          'blasting levee',
          'nuclear explosion',
          'induced or triggered event',
          'rock burst',
          'reservoir loading',
          'fluid injection',
          'fluid extraction',
          'crash',
          'plane crash',
          'train crash',
          'boat crash',
          'other event',
          'atmospheric event',
          'sonic boom',
          'sonic blast',
          'acoustic noise',
          'thunder',
          'avalanche',
          'snow avalanche',
          'debris avalanche',
          'hydroacoustic event',
          'ice quak'
        ]
      },
      dirty: true,
      loading: false,
      updating: false,
      magnitude: null,
      commitPopover: false,
      relocateBtnType: null,
      magnitudeBtnType: null,
      map: null,
      markers: [],
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
    if (this.event._origin != null) {
      this.relocateBtnType = 'warning'
      this.magnitudeBtnType = 'warning'
    } else {
      this.relocateBtnType = null
      this.magnitudeBtnType = null
    }
    if (this.dirty) {
      this.dirty = false
      this.magnitude = this.event._magnitudes ? this.event._magnitudes[0] : this.event._pm
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
        a.time_weight = selectedPickIDs.indexOf(a._pick._id) >= 0 ? 1 : 0
      }
      this.updateAll()
    },

    handleSelectionChange (selectedRows) {
      if (this.updating) return
      this.setSelectedArrival(selectedRows.map(x => x.id))
    },

    updateArrivalTableData () {
      let data = this.origin.arrival.map(a => ({
        id: a._pick._id,
        mode: a._pick.evaluation_mode == 'automatic' ? 'A' : 'M',
        modeColor: a._pick.evaluation_mode == 'manual' ? 'success' : 'danger',
        phase: a.phase,
        network: a._pick.waveform_id.network_code,
        station: a._pick.waveform_id.station_code,
        loccha: a._pick._fdsnid.split('.').slice(-2).join('.'),
        polarity: a._pick.polarity != null ? a._pick.polarity : '',
        residual: a.time_residual,
        distance: a.distance,
        azimuth: a.azimuth,
        time: a._traveltime,
        weight: a.time_weight
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
      } else {
        this.map.invalidateSize()
      }
      for (let m of this.markers) {
        m.remove()
      }
      this.markers = []
      let originPos = L.latLng([
        this.origin.latitude.value,
        this.origin.longitude.value
      ])
      let bounds = [originPos]
      for (let a of this.origin.arrival) {
        let pos = this.getStationCoordinates(a._pick._seedid)
        if (pos == null) {
          console.warn(`No coordinates found for channel ${a._pick._seedid}`)
          continue
        }
        bounds.push(pos)
        if (a.time_weight == 1) {
          this.markers.push(L.polyline([originPos, pos], {
            color: 'gray',
            weight: 1
          }).addTo(this.map))
        }
        this.markers.push(L.circleMarker(pos, {
          radius: 2,
          weight: 1,
          color: a.time_weight == 1 ? 'black' : 'gray',
          fillOpacity: 1
        }).bindPopup(a._pick._seedid).addTo(this.map))
      }
      this.markers.push(L.circleMarker(originPos, {
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
          a.time_weight < .5 ? 'gray' :
          a._pick.evaluation_mode == 'automatic' ? 'red' :
          'green'
        )
        this.chart.timeResidual[serie].push({
          x: a.distance, y: a.time_residual, name: a._pick._seedid, color: color, id: a._pick._id
        })
        this.chart.travelTime[serie].push({
          x: a.distance, y: a._traveltime.getTime()/1000., name: a._pick._seedid, color: color, id: a._pick._id
        })
      }
    },

    initChartTimeResidual () {
      let extreme = 1 + Math.floor(
        Math.max.apply(null,
          this.chart.timeResidual.p.concat(this.chart.timeResidual.s).map(x => Math.abs(x.y))
        )
      )
      let container = this.$el.querySelector('.chart-time-residual')
      Highcharts.chart({
        chart: { renderTo: container, type: 'scatter', zoomType: 'xy', events: {
          selection: handleChartSelection,
          selectedpoints: selectedPickIDs => this.setSelectedArrival(selectedPickIDs)
        } },
        title: { text: 'Time residual/Distance' },
        xAxis: { title: { text: 'Distance [°]' }, min: 0 },
        yAxis: { title: { text: 'Time residual [s]'}, min: -1 * extreme, max: extreme },
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
        xAxis: { title: { text: 'Distance [°]' }, min: 0 },
        yAxis: { title: { text: 'Travel time [s]' }, min: 0 },
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

    handleCommitClick () {
      let additionalMagnitudes = this.event._magnitudes != null ? this.event._magnitudes : []
      let e = utils.composeEvent({
        base: this.event,
        origins: this.event.origin.concat([this.origin]),
        po: this.origin,
        magnitudes: this.event.magnitude.concat(additionalMagnitudes),
        pm: this.magnitude
      })
      e.type = this.commitForm.eventType
      if (this.commitForm.eventTypeCertainty != null) {
        e.typeCertainty = this.commitForm.eventTypeCertainty
      }
      if (this.commitForm.originEvaluationStatus != null) {
        let po = e.origin.find(x => x.public_id == e.preferred_origin_id)
        po.evaluation_status = this.commitForm.originEvaluationStatus
      }
      console.log(e);
      utils.ajax({
        method: 'POST',
        url: 'commit',
        type: 'json',
        dataMimeType: 'application/json',
        data: JSON.stringify([e]),
      }).then(data => {
        console.log(data);
      })
    },

    handleComputeMagnitudeClick () {
      this.loading = true
      let e = utils.composeEvent({
        base: this.event,
        origins: [this.origin],
        po: this.origin
      })
      utils.ajax({
        method: 'POST',
        url: 'compute_magnitudes',
        type: 'json',
        dataMimeType: 'application/json',
        data: JSON.stringify([e]),
      }).then(data => {
        this.loading = false
        this.$notify({
          type: data.quakeml == null ? 'error' : 'info',
          message: data.message
        })
        if (data.quakeml != null) {
          let parser = new DOMParser()
          let qml = parser.parseFromString(data.quakeml, 'application/xml')
          let e = utils.xmlNodeToJson(
            qml.getElementsByTagName('eventParameters')[0],
            '',
            utils.CONVERSION_RULES
          ).event[0]
          utils.processEventData(e)
          console.log(e);
          this.event._magnitudes = e.magnitude
          this.magnitude = e.magnitude[0]
          this.magnitudeBtnType = null
        }
      })
    },

    handleRelocateClick () {
      this.loading = true
      let e = utils.composeEvent({
        base: this.event,
        origins: [this.origin],
        po: this.origin
      })
      utils.ajax({
        method: 'POST',
        url: 'relocate',
        type: 'json',
        dataMimeType: 'application/json',
        data: JSON.stringify([e]),
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
            evaluation_mode: 'manual',
            depth: o.depth,
            origin_uncertainty: o.origin_uncertainty,
            creation_info: o.creation_info
          })
          Object.assign(this.origin.quality, {
            associated_phase_count: this.origin.arrival.length,
            used_phase_count: o.arrival.filter(a => a.time_weight == 1).length,
            standard_error: o.quality.standard_error,
          })
          for (let newA of o.arrival) {
            let a = this.origin.arrival.find(x => x._pick_id == newA._pick_id)
            Object.assign(a, {
              azimuth: newA.azimuth,
              distance: newA.distance,
              timeResidual: newA.time_residual
            })
          }
          this.relocateBtnType = null
          this.updateAll()
        }
      })
    }
  }
}
</script>

<style>
/*.event-description {margin: 20px; font-size: .9em;}
.event-description th, .event-description td {padding: 3px;}
.event-description th {text-align: right; padding-right: 10px;}*/
.event-description {width: 100%; font-size: .8em; margin-top: 5px; margin-bottom: 10px;}
.event-description th, td {padding: 8px; text-align: center;}
.event-description th {font-weight: bold; background: #efefef;}

.charts-container {padding-left: 20px;}
</style>
