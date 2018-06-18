<template>
  <div>
    <el-row class="toolbar" type="flex" align="middle">
      <el-form :inline="true">
        <el-form-item>
          <el-button :type="origin._is_dirty ? 'warning': null" icon="el-icon-location" @click="handleRelocateClick">Relocate</el-button>
        </el-form-item>
        <el-form-item>
          <el-button :type="event.preferred_magnitude_id == null ? 'warning': null" @click="handleComputeMagnitudeClick">Compute magnitude</el-button>
        </el-form-item>
        <el-form-item>
          <el-popover placement="bottom" width="300" v-model="commitPopover">
            <el-form :model="commitForm">
              <el-form-item label="Event Type">
                <el-select v-model="commitForm.eventType" clearable>
                  <el-option
                    v-for="opt in commitForm.eventTypeOptions"
                    :key="opt"
                    :label="opt"
                    :value="opt"></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="Type certainty">
                <el-select v-model="commitForm.eventTypeCertainty" clearable>
                  <el-option
                    v-for="opt in commitForm.eventTypeCertaintyOptions"
                    :key="opt"
                    :label="opt"
                    :value="opt"></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="Origin status">
                <el-select v-model="commitForm.originEvaluationStatus" clearable>
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
              :type="origin._not_committed == true ? 'warning': null" slot="reference"
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
    <el-row class="text-right">
      Selector mode <el-switch v-model="originSelectorMode"></el-switch>
    </el-row>
    <el-row>
      <strong>Origin</strong>
      <table class="event-description">
        <thead>
          <th v-if="originSelectorMode"></th>
          <th v-if="originSelectorMode">Creation Time</th>
          <th>Time</th><th>Latitude</th><th>Longitude</th><th>Depth</th><th>Phases</th><th>RMS</th><th>Az. Gap</th><th>Min Dist</th>
        </thead>
        <tbody class="selectable" v-if="originSelectorMode">
          <tr
            v-for="o in event.origin"
            :class="{ preferred: o.public_id == event.preferred_origin_id }"
            @click="$emit('set-current-origin', o)"
            @dblclick="handleSetPreferredOrigin(o)">
            <td><i class="el-icon-view" v-if="o == origin"></i></td>
            <td>{{ o.creation_info._pretty_creation_time }}</td>
            <td>{{ o.time._pretty }}</td>
            <td>{{ o.latitude._pretty }} {{ o.latitude._pretty_uncertainty }}</td>
            <td>{{ o.longitude._pretty }} {{ o.longitude._pretty_uncertainty }}</td>
            <td>{{ o.depth._pretty }} {{ o.depth._pretty_uncertainty }}</td>
            <td>{{ o.quality.used_phase_count }} / {{ o.quality.associated_phase_count }}</td>
            <td>{{ o.quality.standard_error.toFixed(2) }} s</td>
            <td>{{ o.quality.azimuthal_gap.toFixed(0) }} °</td>
            <td>{{ o.quality.minimum_distance.toFixed(2) }} °</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td>{{ origin.time._pretty }}</td>
            <td>{{ origin.latitude._pretty }} {{ origin.latitude._pretty_uncertainty }}</td>
            <td>{{ origin.longitude._pretty }} {{ origin.longitude._pretty_uncertainty }}</td>
            <td>{{ origin.depth._pretty }} {{ origin.depth._pretty_uncertainty }}</td>
            <td>{{ origin.quality.used_phase_count }} / {{ origin.quality.associated_phase_count }}</td>
            <td>{{ origin.quality.standard_error.toFixed(2) }} s</td>
            <td>{{ origin.quality.azimuthal_gap.toFixed(0) }} °</td>
            <td>{{ origin.quality.minimum_distance.toFixed(2) }} °</td>
          </tr>
        </tbody>
      </table>
    </el-row>
    <el-row>
      <strong>Magnitude</strong>
      <table class="event-description" v-if="event._pm != null">
        <thead>
          <th>Value</th><th>Magnitude type</th><th>Station count</th><th>Method</th>
        </thead>
        <tbody class="selectable" v-if="originSelectorMode">
          <tr
            v-for="m in event.magnitude"
            v-if="m.origin_id == origin.public_id"
            :class="{ preferred: m.public_id == event.preferred_magnitude_id }"
            @dblclick="handleSetPreferredMagnitude(m)">
            <td>{{ m.mag._pretty }}</td>
            <td>{{ m.type }}</td>
            <td>{{ m.station_count }}</td>
            <td>{{ m.method_id }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td>{{ event._pm.mag._pretty }}</td>
            <td>{{ event._pm.type }}</td>
            <td>{{ event._pm.station_count }}</td>
            <td>{{ event._pm.method_id }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else>
        <el-alert type="error" title="No preferred magnitude"></el-alert>
      </div>
    </el-row>
    <el-row>
      <el-col :span="8">
        <div class="map-canvas" style="height: 400px;"></div>
      </el-col>
      <el-col :span="16" class="charts-container">
        <el-tabs v-model="activeChartTab" @tab-click="handleChartChange">
          <el-tab-pane name="timeResidual" label="Time residual"><div class="chart-time-residual"></div></el-tab-pane>
          <el-tab-pane name="travelTime" label="Travel time"><div class="chart-travel-time"></div></el-tab-pane>
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
import 'leaflet-ellipse'

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
      originSelectorMode: false,
      dirty: true,
      updating: false,
      commitPopover: false,
      map: null,
      layers: [],
      chart: {
        timeResidual: null,
        travelTime: null
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
        a.time_weight = selectedPickIDs.indexOf(a.pick_id) >= 0 ? 1 : 0
      }
      this.updateAll()
    },

    handleSelectionChange (selectedRows) {
      if (this.updating) return
      this.setSelectedArrival(selectedRows.map(x => x.id))
    },

    updateArrivalTableData () {
      let data = this.origin.arrival.map(a => ({
        id: a._pick.public_id,
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

    updateAll (o) {
      // console.log(o == this.origin);
      // console.log('updateAll', this.origin);
      this.updating = true
      this.updateArrivalTableData()
      this.eventMap()
      this.initChartsData()
      if (this.activeChartTab == 'timeResidual') {
        this.initChartTimeResidual()
      } else if (this.activeChartTab == 'travelTime') {
        this.initChartTravelTime()
      }
      this.$refs.arrivalTable.clearSelection()
      for (let row of this.arrivalTableData) {
        this.$refs.arrivalTable.toggleRowSelection(row, row.weight == 1)
      }
      this.dirty = false
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
      }
      for (let l of this.layers) {
        l.remove()
      }
      this.layers = []
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
          this.layers.push(L.polyline([originPos, pos], {
            color: 'gray',
            weight: 1
          }).addTo(this.map))
        }
        this.layers.push(L.circleMarker(pos, {
          radius: 2,
          weight: 1,
          color: a.time_weight == 1 ? 'black' : 'gray',
          fillOpacity: 1
        }).bindPopup(a._pick._seedid).addTo(this.map))
      }
      this.layers.push(L.ellipse(originPos, [
        this.origin.longitude.uncertainty * 1000,
        this.origin.latitude.uncertainty * 1000
      ], 0, {
        weight: 0,
        color: 'red',
        fillOpacity: .2
      }).addTo(this.map))
      this.layers.push(L.circleMarker(originPos, {
        radius: 8,
        weight: 1,
        color: 'red',
        fillOpacity: .8
      }).addTo(this.map))
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
          x: a.distance, y: a.time_residual, name: a._pick._seedid, color: color, id: a.pick_id
        })
        this.chart.travelTime[serie].push({
          x: a.distance, y: a._traveltime.getTime()/1000., name: a._pick._seedid, color: color, id: a.pick_id
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

    handleChartChange (tab, ev) {
      if (tab.name == 'timeResidual') {
        this.initChartTimeResidual()
      } else if (tab.name == 'travelTime') {
        this.initChartTravelTime()
      }
    },

    handleSetPreferredOrigin (o) {
      this.origin._not_committed = false
      this.event.preferred_origin_id = o.public_id
      o._not_committed = true
      this.$emit('set-current-origin', o)
    },

    handleSetPreferredMagnitude (m) {
      this.event.preferred_magnitude_id = m.public_id
      this.origin._not_committed = true
    },

    handleCommitClick () {
      this.$emit('commit', this.commitForm)
    },

    handleComputeMagnitudeClick () {
      this.$emit('compute-magnitudes')
    },

    handleRelocateClick () {
      this.$emit('relocate')
    }
  }
}
</script>

<style>
/*.event-description {margin: 20px; font-size: .9em;}
.event-description th, .event-description td {padding: 3px;}
.event-description th {text-align: right; padding-right: 10px;}*/
.event-description {width: 100%; font-size: .8em; margin-top: 5px; margin-bottom: 10px;}
.event-description th, td {padding: 4px; text-align: center;}
.event-description th {font-weight: bold; background: #efefef;}
.event-description tr.preferred td {font-weight: bold;}
.event-description .selectable tr:hover {background-color: #fbfbfb; cursor: pointer;}

.charts-container {padding-left: 20px;}
</style>
