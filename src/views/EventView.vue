<template>
  <v-card v-if="event != null && origin != null" class="pt-3 px-3 pb-5">

    <event-tools
      @need-update="updateAll"
      @need-init="initEvent"
      :selected-station-magnitude="selectedStationMagnitude"></event-tools>

    <event-description @need-update="updateAll"></event-description>

    <v-layout>
      <v-flex xs12 md4>
        <div class="event-view__map-canvas" :style="{ height: '400px', zIndex: 1 }"></div>
      </v-flex>
      <v-flex xs12 md8 class="event-view__chart-container">
        <v-tabs v-model="activeChartTab" @change="handleChartChange" right>
          <v-tab>Time residual</v-tab>
          <v-tab>Travel time</v-tab>
          <v-tab>Magnitude</v-tab>
          <v-tab>First motion (beta)</v-tab>
          <v-tab-item class="event-view__chart--time-residual" eager></v-tab-item>
          <v-tab-item class="event-view__chart--travel-time" eager></v-tab-item>
          <v-tab-item class="event-view__chart--magnitudes" eager></v-tab-item>
          <v-tab-item class="event-view__chart--first-motion" eager>
            <first-motion :active="firstMotionActive"></first-motion>
          </v-tab-item>
        </v-tabs>
      </v-flex>
    </v-layout>

    <v-data-table
      v-model="arrivalTableSelected"
      :headers="arrivalTableHeader"
      :items="arrivalTableData"
      :sort-desc="false"
      sort-by="distance"
      :page="1"
      :items-per-page="-1"
      @input="handleSelectionChange"
      item-key="id"
      show-select>
      <template v-slot:item="props">
        <tr @click="handleRowClick(props.item)">
          <td><v-checkbox @change="handleRowSelection(props.item, $event)" :input-value="props.isSelected" primary hide-details :true-value="true" :false-value="false"></v-checkbox></td>
          <td><v-chip label outlined small :color="props.item.modeColor">{{ props.item.mode }}</v-chip></td>
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

<script lang="ts">
/// <reference path="../l.ellipse.d.ts" />
import Vue from 'vue'
import Highcharts from 'highcharts'
import addMore from 'highcharts/highcharts-more'
import * as utils from '@/utils/utils'
import L, { LatLngExpression } from 'leaflet'
import 'leaflet-ellipse'
import { ComplexPoint, EventViewArrivalTableRow, EventViewChartSeries, MagnitudeComplexPoint, StringIndexedObject, WebpickerArrival, WebpickerEventParameters, WebpickerInventory, WebpickerOrigin } from '@/types'

addMore(Highcharts)

interface EventView extends Vue {
  shiftPressed: boolean;
  handleKeydown: (ev: KeyboardEvent) => void;
  handleKeyup: (ev: KeyboardEvent) => void;
  setSelectedStationMagnitude: (selectedWfid: string[]) => void;
  setSelectedArrival: (selectedWfid: string[]) => void;
}

const handleChartSelection = function (this: Highcharts.Chart, ev: Highcharts.ChartSelectionContextObject, self: EventView, magnitudeChart = false) {
  const [x, y] = [ev.xAxis[0], ev.yAxis[0]]
  const selectedPickIDs = []
  for (const s of this.series) {
    for (let i = 0; i < s.points.length; i++) {
      const p = s.points[i] as ComplexPoint
      if (magnitudeChart || ((self.shiftPressed && p.manual) || !self.shiftPressed)) {
        if (p.x >= x.min && p.x <= x.max && p.y >= y.min && p.y <= y.max) {
          selectedPickIDs.push(p.id)
        }
      }
    }
  }
  if (magnitudeChart) {
    self.setSelectedStationMagnitude(selectedPickIDs)
  } else {
    self.setSelectedArrival(selectedPickIDs)
  }
  return false
}

export default Vue.extend({

  props: {
    code: {
      type: String,
      required: true,
      default: ''
    }
  },

  data () {
    return {
      dirty: true,
      updating: false,
      map: null as L.Map | null,
      layers: {} as Record<string, L.Layer>,

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
      arrivalTableData: [] as EventViewArrivalTableRow[],
      arrivalTableSelected: [] as EventViewArrivalTableRow[],
      // arrivalTablePagination: {
      //   descending: false,
      //   page: 1,
      //   rowsPerPage: -1,
      //   sortBy: 'distance',
      //   totalItems: null
      // } as EventViewArrivalTableDataPagination,

      selectedStationMagnitude: [] as string[],

      activeChartTab: 0,
      firstMotionActive: false,
      chart: {
        timeResidual: null as EventViewChartSeries | null,
        travelTime: null as EventViewChartSeries | null,
        // magnitudes: null as Record<string, MagnitudeComplexPoint[]> | null
        magnitudes: {} as { [s: string]: MagnitudeComplexPoint[] }
      },
      shiftPressed: false,
      keyHandlersBinded: false,
      eventHandler: {
        keydown: (ev: KeyboardEvent): void => {},
        keyup: (ev: KeyboardEvent): void => {}
      }
    }
  },

  computed: {
    event (): WebpickerEventParameters {
      const result = this.$store.state.currentEvent
      return result
    },
    origin (): WebpickerOrigin {
      const result = this.$store.state.currentOrigin
      return result
    },
    inventory (): WebpickerInventory {
      const result = this.$store.state.inventory
      return result
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
    this.$store.dispatch('setAuthorStatus', { eventid: this.code, action: 'reviewing' })
    if (this.event == null || this.event.public_id !== this.code) {
      this.initEvent()
    } else {
      this.updateAll()
    }
    if (!this.keyHandlersBinded) {
      this.keyHandlersBinded = true
      this.eventHandler.keydown = (ev) => this.handleKeydown(ev)
      this.eventHandler.keyup = (ev) => this.handleKeyup(ev)
      document.body.addEventListener('keydown', this.eventHandler.keydown)
      document.body.addEventListener('keyup', this.eventHandler.keyup)
    }
  },

  beforeDestroy () {
    if (this.keyHandlersBinded) {
      this.keyHandlersBinded = false
      document.body.removeEventListener('keydown', this.eventHandler.keydown)
      document.body.removeEventListener('keyup', this.eventHandler.keyup)
    }
  },

  methods: {

    handleKeydown (ev: KeyboardEvent): void {
      if (ev.key === 'Shift') {
        this.shiftPressed = true
      }
    },

    handleKeyup (ev: KeyboardEvent): void {
      if (ev.key === 'Shift') {
        this.shiftPressed = false
      }
    },

    initEvent () {
      this.$store.dispatch('setLoading', { value: true, text: 'Loading event description...' })
      this.$store.dispatch('log', '[EventView::initEvent] send event full description request')
      utils.ajax({
        method: 'GET',
        url: this.$store.getters.getLink('fdsnws/event/1/query'),
        args: {
          format: 'xml',
          eventid: this.code,
          includeallorigins: 'true',
          includeallmagnitudes: 'true',
          includearrivals: 'true',
          includefocalmechanism: 'true',
          includestationmagnitudes: 'true'

          // Non-standard argument handled by site_routage.
          // It used to get event description from scxmldump (if possible)
          // instead of requesting the regular FDSNWS. So that the amplitude and
          // the station magnitude are retrieved, which is not the case from FDSNWS.
          // fulldescription: 'true'
        },
        type: 'document'
      }).then(qml => {
        const e = utils.parseQuakeML(qml as Document)[0]
        console.log('[EventView::initEvent] full description event', e)
        this.$store.dispatch('log', '[EventView::initEvent] full description event received')
        const chList = []
        for (const o of e.origin) {
          o._is_dirty = false
          for (const a of o.arrival) {
            const ch = a._pick._fdsnid.split('.').slice(0, 3).concat(['*']).join(' ')
            if (chList.indexOf(ch) < 0) {
              chList.push(ch)
            }
          }
        }
        const t = e._po.time.value.slice(0, 19)
        this.$store.dispatch('setLoading', { value: true, text: 'Loading inventory...' })
        this.$store.dispatch('log', '[EventView::initEvent] send loading inventory request')
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
          this.$store.dispatch('setInventory', utils.parseInventory(data as string))
          this.$store.dispatch('setCurrentEvent', e)
          this.$nextTick(function () {
            this.updateAll()
            this.$store.dispatch('setLoading', { value: false })
          })
        }).catch(data => {
          this.$store.dispatch('log', `[EventView::initEvent] send loading inventory request failed: ${data}`)
        })
      }).catch(data => {
        this.$store.dispatch('log', `[EventView::initEvent] send event full description request failed: ${data}`)
      })
    },

    floatFormatter (value: number | null) {
      return value == null ? '' : value.toFixed(2)
    },

    timeFormatter (value: Date) {
      // return value.toISOString().split('T')[1].substr(0, 12)
      return value.toISOString().split('T')[1].substr(0, 8)
    },

    setSelectedArrival (selectedPickIDs: string[]) {
      for (const a of this.origin.arrival) {
        a.time_weight = selectedPickIDs.indexOf(a.pick_id) >= 0 ? 1 : 0
      }
      this.updateAll()
    },

    setSelectedStationMagnitude (selectedWfid: string[]) {
      const tmp: StringIndexedObject = {}
      if (selectedWfid.length === 0) {
        for (const a of this.origin.arrival) {
          const netsta = a._pick._seedid.split('.').slice(0, 2).join('.')
          tmp[netsta] = null
        }
      } else {
        for (const wfid of selectedWfid) {
          const netsta = wfid.split('.').slice(0, 2).join('.')
          tmp[netsta] = null
        }
      }
      this.selectedStationMagnitude = Object.keys(tmp)
      this.initChartsData()
      this.initChartMagnitude()
    },

    handleRowSelection (row: EventViewArrivalTableRow, value: boolean) {
      let selected = this.arrivalTableSelected.map(x => x)
      if (value === true) {
        selected.push(row)
      } else {
        selected = selected.filter(x => x.id !== row.id)
      }
      this.arrivalTableSelected = selected
      this.handleSelectionChange(selected)
    },

    handleSelectionChange (selectedRows: EventViewArrivalTableRow[]) {
      if (this.updating) return
      this.setSelectedArrival(selectedRows.map(x => x.id))
    },

    updateArrivalTableData () {
      // this.arrivalTablePagination.totalItems = this.origin.arrival.length
      this.arrivalTableData = this.origin.arrival.map((a: WebpickerArrival) => ({
        id: a._pick.public_id,
        mode: a._pick.evaluation_mode === 'automatic' ? 'A' : 'M',
        modeColor: a._pick.evaluation_mode === 'manual' ? 'green' : 'red',
        phase: a.phase,
        network: a._pick.waveform_id.network_code,
        station: a._pick.waveform_id.station_code,
        loccha: a._pick._fdsnid.split('.').slice(-2).join('.'),
        takeoffAngle: a.takeoff_angle != null ? a.takeoff_angle.value.toFixed(2) : '',
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
      if (this.activeChartTab === 0) {
        this.initChartTimeResidual()
      } else if (this.activeChartTab === 1) {
        this.initChartTravelTime()
      } else if (this.activeChartTab === 2) {
        this.initChartMagnitude()
      }
      this.arrivalTableSelected = []
      for (const row of this.arrivalTableData) {
        if (row.weight === 1) {
          this.arrivalTableSelected.push(row)
        }
      }
      this.dirty = false
      this.updating = false
    },

    initMap () {
      const container = this.$el.querySelector('.event-view__map-canvas')
      this.map = utils.initMap(container as HTMLElement)
    },

    getStationCoordinates (seedid: string): L.LatLngTuple | null {
      const [n, s] = seedid.split('.').slice(0, 2)
      if (this.inventory[n] != null &&
          this.inventory[n][s] != null) {
        const sta = this.inventory[n][s]
        return [sta.lat, sta.lon]
      }
      return null
    },

    eventMap () {
      if (this.map == null) {
        this.initMap()
      }
      if (this.map == null) {
        return
      }
      for (const l of Object.values(this.layers)) {
        l.remove()
      }
      this.layers = {}
      const originPos: LatLngExpression = [
        this.origin.latitude.value,
        this.origin.longitude.value
      ]
      const bounds: L.LatLngBoundsExpression = [originPos]
      const arrivalPerStation: Record<string, WebpickerArrival> = {}
      let maxRes = 0
      for (const a of this.origin.arrival) {
        const netsta = a._pick._seedid.split('.').slice(0, 2).join('.')
        if (a.time_weight > 0) {
          maxRes = Math.max(maxRes, Math.abs(a.time_residual))
        }
        const otherArr = arrivalPerStation[netsta]
        if (otherArr == null) {
          arrivalPerStation[netsta] = a
        } else {
          if (a.time_weight !== 0 && (
            otherArr.time_weight === 0 ||
                Math.abs(a.time_residual) > Math.abs(otherArr.time_residual))) {
            arrivalPerStation[netsta] = a
          }
        }
      }
      utils.RESIDUAL_COLOR_SCALE[0][0] = -maxRes
      utils.RESIDUAL_COLOR_SCALE[2][0] = maxRes
      for (const [netsta, a] of Object.entries(arrivalPerStation)) {
        const pos = this.getStationCoordinates(a._pick._seedid)
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
            a.time_weight > 0
              ? utils.toRGB(utils.applyScale(a.time_residual, utils.RESIDUAL_COLOR_SCALE) as [number, number, number])
              : 'gray'
          ),
          fillOpacity: 1
        }).bindPopup(a._pick._seedid).addTo(this.map)
      }
      if (this.origin.longitude.uncertainty != null && this.origin.latitude.uncertainty != null) {
        this.layers.ellipse = L.ellipse(originPos, [
          this.origin.longitude.uncertainty * 1000,
          this.origin.latitude.uncertainty * 1000
        ], 0, {
          weight: 0,
          color: 'red',
          fillOpacity: 0.2
        }).addTo(this.map)
      }
      this.layers.epicenter = L.circleMarker(originPos, {
        radius: 8,
        weight: 1,
        color: 'red',
        fillOpacity: 0.8
      }).addTo(this.map)
      this.map.fitBounds(bounds)
      // console.log(this.origin);
    },

    initChartsData () {
      // console.log('initChartsData');
      this.chart.timeResidual = { p: [], s: [] }
      this.chart.travelTime = { p: [], s: [] }
      const tmp: StringIndexedObject = {}
      for (const a of this.origin.arrival) {
        const netsta = a._pick._seedid.split('.').slice(0, 2).join('.')
        tmp[netsta] = null
        const serie = (a.phase === 'P' ? 'p' : 's')
        const color = (
          a.time_weight < 0.5
            ? 'gray'
            : a._pick.evaluation_mode === 'automatic'
              ? 'red'
              : 'green'
        )
        this.chart.timeResidual[serie].push({
          x: a.distance,
          y: a.time_residual,
          name: a._pick._seedid,
          color: color,
          id: a.pick_id,
          manual: a._pick.evaluation_mode === 'manual'
        })
        this.chart.travelTime[serie].push({
          x: a.distance,
          y: a._traveltime!.getTime() / 1000.0,
          name: a._pick._seedid,
          color: color,
          id: a.pick_id,
          manual: a._pick.evaluation_mode === 'manual'
        })
      }
      if (this.selectedStationMagnitude.length === 0) {
        this.selectedStationMagnitude = Object.keys(tmp)
      }
      const colors = Highcharts.getOptions().colors
      let colorIndex = 0
      for (const mag of this.event.magnitude!) {
        if (mag.origin_id !== this.origin.public_id || mag.station_magnitude_contribution == null) {
          continue
        }
        if (this.chart.magnitudes[mag.type] == null) {
          this.chart.magnitudes[mag.type] = []
        }
        for (const smc of mag.station_magnitude_contribution) {
          if (smc._station_magnitude == null) {
            continue
          }
          const arrival = this.origin.arrival.find(a => a._pick._seedid === smc._station_magnitude!._seedid)
          if (arrival == null) {
            console.warn(`Failed to retreive corresponding arrival for station magnitude of channel ${smc._station_magnitude!._seedid}`)
            continue
          }
          const netsta = smc._station_magnitude._seedid!.split('.').slice(0, 2).join('.')
          let color: Highcharts.ColorString | Highcharts.GradientColorObject | Highcharts.PatternObject = 'gray'
          if (this.selectedStationMagnitude.indexOf(netsta) >= 0) {
            color = new Highcharts.Color(colors![colorIndex]).setOpacity(Math.max(0.2, smc.weight)).get()
          }
          this.chart.magnitudes[mag.type].push({
            x: arrival.distance,
            y: smc._station_magnitude.mag.value,
            id: smc._station_magnitude._seedid,
            color,
            type: mag.type,
            weight: smc.weight
          })
        }
        colorIndex++
      }
    },

    initChartTimeResidual () {
      const extreme = 1 + Math.floor(
        Math.max.apply(null,
          this.chart.timeResidual!.p.concat(this.chart.timeResidual!.s).map(x => Math.abs(x.y))
        )
      )
      const container: HTMLElement | null = this.$el.querySelector('.event-view__chart--time-residual')
      if (container == null) {
        return
      }
      const self = this
      Highcharts.chart({
        chart: {
          backgroundColor: 'rgba(255,255,255,0)',
          renderTo: container,
          type: 'scatter',
          zoomType: 'xy',
          events: {
            selection: function (ev) { return handleChartSelection.call(this, ev, self) }
          }
        },
        title: { text: 'Time residual/Distance' },
        xAxis: { title: { text: 'Distance [°]' }, min: 0 },
        yAxis: { title: { text: 'Time residual [s]' }, min: -1 * extreme, max: extreme },
        tooltip: {
          formatter: function () {
            if (typeof this.x === 'number' && typeof this.y === 'number') {
              return `<b>${this.point.name}</b><br>Distance: ${this.x.toFixed(2)}°<br>Residual: ${this.y.toFixed(2)} s`
            }
          }
        },
        plotOptions: {
          series: {
            animation: false,
            states: {
              inactive: {
                enabled: false
              }
            }
          }
        },
        series: [
          { name: 'P', type: 'scatter', data: this.chart.timeResidual!.p },
          { name: 'S', type: 'scatter', data: this.chart.timeResidual!.s }
        ]
      })
    },

    initChartTravelTime () {
      const container: HTMLElement | null = this.$el.querySelector('.event-view__chart--travel-time')
      if (container == null) {
        return
      }
      const self = this
      Highcharts.chart({
        chart: {
          backgroundColor: 'rgba(255,255,255,0)',
          renderTo: container,
          type: 'scatter',
          zoomType: 'xy',
          events: {
            selection: function (ev) { return handleChartSelection.call(this, ev, self) }
          }
        },
        title: { text: 'Travel time/Distance' },
        xAxis: { title: { text: 'Distance [°]' }, min: 0 },
        yAxis: { title: { text: 'Travel time [s]' }, min: 0 },
        tooltip: {
          formatter: function () {
            if (typeof this.x === 'number' && typeof this.y === 'number') {
              return `<b>${this.point.name}</b><br>Distance: ${this.x.toFixed(2)}°<br>Time: ${this.y.toFixed(2)} s`
            }
          }
        },
        plotOptions: { series: { animation: false } },
        series: [
          { name: 'P', type: 'scatter', data: this.chart.travelTime!.p },
          { name: 'S', type: 'scatter', data: this.chart.travelTime!.s }
        ]
      })
    },

    initChartMagnitude () {
      const container: HTMLElement | null = this.$el.querySelector('.event-view__chart--magnitudes')
      if (container == null) {
        return
      }
      const self = this
      Highcharts.chart({
        chart: {
          backgroundColor: 'rgba(255,255,255,0)',
          renderTo: container,
          type: 'scatter',
          zoomType: 'xy',
          events: {
            selection: function (ev) { return handleChartSelection.call(this, ev, self, true) }
          }
        },
        title: { text: 'Station magnitudes' },
        xAxis: { title: { text: 'Distance [°]' }, min: 0 },
        yAxis: { title: { text: 'Magnitude' } },
        tooltip: {
          formatter: function () {
            const p: MagnitudeComplexPoint = this.point
            if (typeof this.x === 'number' && typeof this.y === 'number') {
              return `<b>${p.id}</b><br>Distance: ${this.x.toFixed(2)}°<br>Magnitude: ${this.y.toFixed(2)} ${p.type}<br>Weight: ${p.weight!.toFixed(2)}`
            }
          }
        },
        plotOptions: { series: { animation: false } },
        series: Object.entries(this.chart.magnitudes).map(([k, v]) => ({ name: k, type: 'scatter', data: v }))
      })
    },

    handleRowClick (row: EventViewArrivalTableRow) {
      const netsta = `${row.network}.${row.station}`
      this.layers[netsta].openPopup()
    },

    handleChartChange (tab: number) {
      if (tab === 0) {
        this.initChartTimeResidual()
      } else if (tab === 1) {
        this.initChartTravelTime()
      } else if (tab === 2) {
        this.initChartMagnitude()
      } else if (tab === 3) {
        this.firstMotionActive = true
      }
    }

  }
})
</script>

<style lang="css">
.event-view__chart-container {padding-left: 20px;}
</style>
