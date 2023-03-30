<template>
  <div>
    <progress-bar
      v-model="loading"
      :size="settings['pickerProgressBar.size']"
      :color="settings['pickerProgressBar.color']"
    ></progress-bar>
    <v-app-bar dense :style="{ zIndex: 10 }">
      <v-select
        v-model="tools.phase"
        label="Phase"
        :items="tools.phaseOptions"
        hide-details
        clearable
        title="Select phase"
        solo
        dense
        flat
      ></v-select>
      <v-divider vertical class="mx-2"></v-divider>

      <v-checkbox v-model="tools.sameScale" label="Same scale" hide-details :style="{ maxWidth: '160px' }"></v-checkbox>
      <v-divider vertical class="mx-2"></v-divider>

      <v-select
        v-model="tools.filter"
        label="Filter"
        item-text="name"
        :items="tools.filterList"
        hide-details
        clearable
        title="Select filter"
        solo
        dense
        flat
      ></v-select>
      <v-divider vertical class="mx-2"></v-divider>

      <v-btn-toggle v-model="tools.alignment" mandatory dense>
        <v-btn text :value="'O'" title="Align by origin time">O</v-btn>
        <v-btn text :value="'P'" title="Align by theoretical P wave">P</v-btn>
        <v-btn text :value="'S'" title="Align by theoretical S wave">S</v-btn>
      </v-btn-toggle>
      <v-divider vertical class="mx-2"></v-divider>

      <v-btn-toggle v-model="tools.focusComponent" mandatory dense>
        <v-btn text v-for="(comp, index) in tools.focusComponentOption" :key="index">{{ comp }}</v-btn>
      </v-btn-toggle>
      <v-divider vertical class="mx-2"></v-divider>

      <v-btn-toggle v-model="tools.sortBy" mandatory dense>
        <v-btn text :value="'distance'" title="Sort by distance"><v-icon>mdi-map-marker-distance</v-icon></v-btn>
        <v-btn text :value="'name'" title="Sort by name"><v-icon>mdi-sort-alphabetical-ascending</v-icon></v-btn>
      </v-btn-toggle>
      <v-divider vertical class="mx-2"></v-divider>

      <station-radius-selector
        v-model="tools.stationRadius"
        :disabled="disableLoadAdditionalStation"
        @changeLocation="handleChangeLocation"
        @submit="loadRadiusStation"
      ></station-radius-selector>
      <v-divider vertical class="mx-2"></v-divider>

      <v-menu offset-y bottom left :close-on-content-click="false" v-model="additionalWaveformsChannelsMenu">
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon title="Add component" :disabled="additionalWaveformsChannels.length == 0">
            <v-icon>mdi-playlist-plus</v-icon>
          </v-btn>
        </template>
        <v-list>
          <v-list-item @click="() => null" v-for="channel in additionalWaveformsChannels" :key="channel.label">
            <v-list-item-action>
              <v-checkbox v-model="channel.value"></v-checkbox>
            </v-list-item-action>
            <v-list-item-content @click="channel.value = !channel.value">{{ channel.label }}</v-list-item-content>
          </v-list-item>
          <v-list-item>
            <v-list-item-action></v-list-item-action>
            <v-list-item-content>
              <v-btn @click="handleAdditionalWaveformSubmit">Ok</v-btn>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-menu>
      <v-divider vertical class="mx-2"></v-divider>

      <v-select
        v-model="tools.rotation"
        label="Rotation"
        :items="tools.rotationOptions"
        hide-details
        title="Select rotation"
        solo
        dense
        flat
      ></v-select>
      <v-divider vertical class="mx-2"></v-divider>
      <v-switch
        v-model="tools.phasenet"
        label="Phasenet"
        class="mt-5"
        :color="$store.state.settings['pickerColor.phasenet']"
      />
    </v-app-bar>
    <div class="picker-view__container--picker"></div>
    <div class="picker-view__container--list"></div>
  </div>
</template>

<script lang="ts">
/// <reference path="../fili.d.ts" />
import Vue from 'vue'
import { Waveform, WaveformItem, WaveformItemOptions, WaveformOptions, WaveformPick, PickEvent, WaveformColorOptions } from '@/lib/waveform'
import * as utils from '@/utils/utils'
import { Stream, Trace } from '@/lib/mseed'
import Fili from 'fili'
import L from 'leaflet'
import { FiliFilterOptions, FilterDescription, PhasenetPickObject, StringIndexedObject, TheoreticalTravelTimeObject, WebpickerInventory, WebpickerOrigin, WebpickerSettings } from '@/types'

interface PickerView extends Vue {
  handleUpdatePick: (ev: PickEvent) => void;
  handleWaveformClick: (wf: WaveformItemOptions) => void;
  list: Waveform;
  picker: Waveform;
  tools: {[index: string]: any};
  uncertaintyList: (number | null)[];
}

export default Vue.extend({

  data () {
    const phasenet = localStorage.getItem('phasenet')
    return {
      loading: null as number | null,
      // toolbar variables
      tools: {
        rotationOptions: ['ZNE', 'ZRT'],
        rotation: 'ZNE',
        phaseOptions: [
          { value: 'P', text: 'P' },
          { value: 'S', text: 'S' }
        ],
        focusComponent: 0,
        focusComponentOption: [] as string[],
        phase: null,
        sameScale: false,
        filter: null as string | null,
        lastFilter: 'HP 1',
        alignment: 'O',
        sortBy: 'distance',
        stationRadius: 1,
        filterList: this.$store.state.settings['picker.filters'],
        phasenet: phasenet != null ? JSON.parse(phasenet) : false
      },

      uncertaintyList: [null, 0.05, 0.2, 0.5, 0.8, 1.0, 1.2, 1.5, 2.0, 99.0],

      // state variables
      picksDirty: false,
      keyDownBinded: false,
      horizontalDownloadStatus: '',
      disableLoadAdditionalStation: true,
      xhr: [] as XMLHttpRequest[],

      // additional waveforms by station selected by user
      additionalWaveformsChannelsMenu: false,
      additionalWaveformsChannels: [] as {value: boolean, label: string}[],
      additionalWaveforms: {} as {[netsta: string]: string[]},

      // cache variables
      picks: {} as {[seedid: string]: WaveformPick[]},
      waveform: {} as {[index: string]: WaveformItemOptions},
      stationDistance: {} as {[netsta: string]: number},
      stationCoordinates: {} as {[netsta: string]: [number, number, number]},
      stationAzimuth: {} as {[netsta: string]: number},

      // instances
      list: null as Waveform | null,
      picker: null as Waveform | null,

      // constructor options
      defaultView: { duration: 30000, offset: 10000 },
      pickerOpt: {
        mode: 'picker',
        container: '.picker-view__container--picker',
        // size: { height: 120 },
        waveforms: [],
        equalScale: false,
        view: {},
        callback: {
          updatePick: (ev: PickEvent) => {
            const self = this as PickerView
            self.handleUpdatePick(ev)
          },
          draw: (view: {start: number, end: number}) => {
            const self = this as PickerView
            self.list.setSelectedWaveformWindow(view)
          },
          waveformFocus: (index: number) => {
            const self = this as PickerView
            self.tools.focusComponent = index
          }
        }
      } as WaveformOptions,
      listOpt: {
        mode: 'list',
        container: '.picker-view__container--list',
        // size: { height: this.settings['pickerSize.listWaveformHeight'] },
        waveforms: [],
        equalScale: false,
        view: {},
        callback: {
          waveformClick: (wf: WaveformItemOptions) => {
            const self = this as PickerView
            self.handleWaveformClick(wf)
          }
        }
      } as WaveformOptions,

      // keybinding mapping
      shortcutAction: {
        nextStation: function (this: PickerView) { this.list.selectNext() },
        previousStation: function (this: PickerView) { this.list.selectPrev() },
        setPolarityPositive: function (this: PickerView) { this.picker.setPolarity('positive') },
        setPolarityNegative: function (this: PickerView) { this.picker.setPolarity('negative') },
        setNoPolarity: function (this: PickerView) { this.picker.setPolarity(null) },
        leavePickingMode: function (this: PickerView, ev: KeyboardEvent) { ev.preventDefault(); this.tools.phase = null },
        setPickerPhaseP: function (this: PickerView) { this.tools.phase = 'P' },
        setPickerPhaseS: function (this: PickerView) { this.tools.phase = 'S' },
        deletePick: function (this: PickerView) { this.picker.deleteSelectedPicks() },
        alignToOrigin: function (this: PickerView) { this.tools.alignment = 'O' },
        alignToP: function (this: PickerView) { this.tools.alignment = 'P' },
        alignToS: function (this: PickerView) { this.tools.alignment = 'S' },
        toggleFilter: function (this: PickerView) { this.tools.filter = this.tools.filter == null ? this.tools.lastFilter : null },
        toggleEqualScale: function (this: PickerView) { this.tools.sameScale = !this.tools.sameScale },
        createPick: function (this: PickerView, ev: KeyboardEvent) { ev.preventDefault(); this.picker.createPick() },
        movePickLineRight: function (this: PickerView) { this.picker.movePickLine('right', false) },
        moveFastPickLineRight: function (this: PickerView) { this.picker.movePickLine('right', true) },
        movePickLineLeft: function (this: PickerView) { this.picker.movePickLine('left', false) },
        moveFastPickLineLeft: function (this: PickerView) { this.picker.movePickLine('left', true) },
        xZoomIn: function (this: PickerView) { this.picker != null && this.picker.xZoomIn() },
        xZoomOut: function (this: PickerView) { this.picker != null && this.picker.xZoomOut() },
        yZoomIn: function (this: PickerView) { this.picker != null && this.picker.yZoomIn() },
        yZoomOut: function (this: PickerView) { this.picker != null && this.picker.yZoomOut() },
        setFocusComponentZ: function (this: PickerView) { this.tools.focusComponent = 0 },
        setFocusComponentN: function (this: PickerView) { this.tools.focusComponent = 1 },
        setFocusComponentE: function (this: PickerView) { this.tools.focusComponent = 2 },
        setTimeUncertainty0: function (this: PickerView) { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[0]) },
        setTimeUncertainty1: function (this: PickerView) { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[1]) },
        setTimeUncertainty2: function (this: PickerView) { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[2]) },
        setTimeUncertainty3: function (this: PickerView) { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[3]) },
        setTimeUncertainty4: function (this: PickerView) { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[4]) },
        setTimeUncertainty5: function (this: PickerView) { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[5]) },
        setTimeUncertainty6: function (this: PickerView) { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[6]) },
        setTimeUncertainty7: function (this: PickerView) { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[7]) },
        setTimeUncertainty8: function (this: PickerView) { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[8]) },
        setTimeUncertainty9: function (this: PickerView) { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[9]) }
      } as StringIndexedObject
    }
  },

  computed: {
    origin (): WebpickerOrigin {
      return this.$store.state.currentOrigin
    },
    inventory (): WebpickerInventory {
      return this.$store.state.inventory
    },
    settings (): WebpickerSettings {
      return this.$store.state.settings
    },
    ttt: {
      get: function (): TheoreticalTravelTimeObject {
        return this.$store.state.tttCache
      },
      set: function (ttt: TheoreticalTravelTimeObject) {
        this.$store.dispatch('setTTTCache', ttt)
      }
    },
    phasenet: {
      get: function (): PhasenetPickObject {
        return this.$store.state.phasenetCache
      },
      set: function (ttt: PhasenetPickObject) {
        this.$store.dispatch('setPhasenetCache', ttt)
      }
    },
    trace () {
      return this.$store.state.traceCache
    }
  },

  watch: {
    'tools.phasenet': function (val) {
      localStorage.setItem('phasenet', JSON.stringify(val))
      if (val === true) {
        this.loadPhasenetPick(this.picker!.opt.waveforms)
      }
    },
    'tools.phase': function (val) {
      utils.blurActiveElement()
      if (this.picker != null) {
        this.picker.setPickerPhase(val)
      }
    },
    'tools.sameScale': function (val) {
      utils.blurActiveElement()
      if (this.picker != null) {
        this.picker.opt.equalScale = val
        this.picker.draw()
      }
    },
    'tools.filter': function (val) {
      utils.blurActiveElement()
      if (val && this.picker != null && this.list != null) {
        this.applyFilter(null)
        // this.list.setFilterState(true)
        // this.picker.setFilterState(true)
      } else {
        this.resetFilter()
      }
    },
    'tools.alignment': function (val) {
      utils.blurActiveElement()
      if (this.picker != null && this.list != null) {
        this.list.setTimeAlignment(val)
        this.list.draw()
        this.picker.setTimeAlignment(val)
        this.picker.draw()
      }
    },
    'tools.focusComponent': function (val, oldVal) {
      utils.blurActiveElement()
      if (this.picker != null && val !== oldVal) {
        this.picker.setFocusWaveform(val)
      }
    },
    'tools.sortBy': function (val) {
      utils.blurActiveElement()
      this.sortWaveforms()
    },
    'tools.rotation': function () {
      utils.blurActiveElement()
      if (this.picker != null) {
        this.handleWaveformClick(this.picker.waveforms[0].opt, true)
      }
    }
  },

  mounted () {
    if (this.origin == null) {
      console.error('[PickerView::mounted] No event found')
      return
    }
    this.$store.dispatch('setAuthorStatus', {
      eventid: this.$store.state.currentEvent.public_id,
      action: 'picking'
    })
    this.picksDirty = false
    if (!this.keyDownBinded) {
      this.keyDownBinded = true
      document.body.addEventListener('keydown', this.handleKeyDown)
    }

    const fdsnidList = this.processArrival()
    this.getTTT().then(() => {
      this.downloadWaveforms(fdsnidList, (wfList: WaveformItemOptions[]) => this.setListWaveforms(wfList)).then(() => {
        this.disableLoadAdditionalStation = false
      })
    })
  },

  beforeDestroy () {
    this.$store.dispatch('setLoading', { value: false })
    if (this.xhr.length > 0) {
      for (const xhr of this.xhr) {
        xhr.abort()
      }
    }
    document.body.removeEventListener('keydown', this.handleKeyDown)
    if (this.picker != null) {
      this.picker.destroy()
    }
    if (this.list != null) {
      this.list.destroy()
    }
    if ((this.picks == null && this.ttt == null) || this.picksDirty === false) {
      return
    }
    const arrivals = []
    for (const [seedid, picks] of Object.entries(this.picks)) {
      const [net, sta, loc, cha] = seedid.split('.')
      const netsta = `${net}.${sta}`
      for (const p of picks) {
        const pTime = new Date(p.time)
        arrivals.push({
          azimuth: this.stationAzimuth[netsta],
          distance: this.stationDistance[netsta],
          phase: p.phase,
          pick_id: p.id,
          time_residual: p.residual,
          takeoff_angle: p.takeoff,
          time_weight: p.weight,
          _traveltime: new Date(pTime.getTime() - this.origin.time._value.getTime()),
          _pick: {
            public_id: p.id,
            creation_info: p.creation_info,
            filter_id: p.filter,
            evaluation_mode: p.mode,
            phase_hint: p.phase,
            polarity: p.polarity,
            _seedid: seedid,
            _fdsnid: seedid.replace('..', '.--.'),
            time: {
              value: pTime.toISOString(),
              _value: pTime,
              lower_uncertainty: p.lower_uncertainty,
              upper_uncertainty: p.upper_uncertainty
            },
            waveform_id: {
              network_code: net,
              station_code: sta,
              location_code: loc === '' ? null : loc,
              channel_code: cha
            }
          }
        })
      }
    }
    this.$store.dispatch('pickerData', arrivals)
  },

  methods: {

    processArrival () {
      const fdsnidList: string[] = []
      this.origin.arrival.sort((a, b) => {
        const aa = a.distance
        const bb = b.distance
        return aa === bb ? 0 : aa < bb ? -1 : 1
      })
      this.picks = {}
      for (const a of this.origin.arrival.values()) {
        const fdsnid = a._pick._fdsnid
        const netsta = fdsnid.split('.').slice(0, 2).join('.')
        const [net, sta] = netsta.split('.')
        const staPos = [this.inventory[net][sta].lat, this.inventory[net][sta].lon] as L.LatLngTuple
        this.stationDistance[netsta] = a.distance
        this.stationCoordinates[netsta] = [staPos[0], staPos[1], this.inventory[net][sta].alt]
        this.stationAzimuth[netsta] = a.azimuth
        utils.pushInObject(this.picks, a._pick._seedid, {
          id: a.pick_id,
          creation_info: a._pick.creation_info,
          phase: a.phase,
          filter: a._pick.filter_id,
          mode: a._pick.evaluation_mode,
          polarity: a._pick.polarity,
          time: a._pick.time._value.getTime(),
          lower_uncertainty: a._pick.time.lower_uncertainty,
          upper_uncertainty: a._pick.time.upper_uncertainty,
          residual: a.time_residual,
          weight: a.time_weight,
          takeoff: a.takeoff_angle
        })
        const zComponent = `${fdsnid.slice(0, -1)}Z`
        const wfidList = [fdsnid].concat(this.getHorizontalIds(zComponent)).concat(this.getAuxiliaryIds(zComponent))
        if (this.getChannel(zComponent) != null) {
          wfidList.push(zComponent)
        }
        for (const fdsnid of wfidList) {
          utils.pushUnique(fdsnidList, fdsnid)
        }
      }
      return fdsnidList
    },

    handleAdditionalWaveformSubmit () {
      this.additionalWaveformsChannelsMenu = false
      const additionalWaveformsChannelsList = this.additionalWaveformsChannels.filter(x => x.value === true).map(x => x.label)
      if (additionalWaveformsChannelsList.length > 0) {
        const netsta = additionalWaveformsChannelsList[0].split('.').slice(0, 2).join('.')
        this.additionalWaveforms[netsta] = additionalWaveformsChannelsList.map(x => x.replace('..', '.--.'))
        this.downloadWaveforms(
          additionalWaveformsChannelsList,
          () => this.handleWaveformClick(this.pickerOpt.waveforms[0], true)
        )
      }
    },

    handleKeyDown (ev: KeyboardEvent) {
      const k = utils.shortcutString(ev)
      const keybindings = Object.keys(this.settings).filter(x => x.indexOf('pickerKeybinding') === 0)
      const bindedAction = []
      for (const key of keybindings) {
        if (this.settings[key] === k) {
          bindedAction.push(key.split('.')[1])
        }
      }
      for (const action of bindedAction) {
        this.shortcutAction[action].call(this as PickerView, ev)
      }
    },

    applyFilter (wfList: WaveformItem[] | null) {
      if (!this.tools.filter) {
        return
      }
      this.tools.lastFilter = this.tools.filter
      const f = this.tools.filterList.find((x: FilterDescription) => x.name === this.tools.filter)
      // let f = this.tools.filter
      if (wfList == null) {
        wfList = this.picker!.waveforms
        // wfList = this.list.waveforms.concat(this.picker.waveforms)
      }
      const iirCalculator = new Fili.CalcCascades()
      for (const wf of wfList) {
        const fs = 1000.0 / wf.opt.step
        const filterOpt: FiliFilterOptions = { Fs: fs, order: f.order, gain: 0, preGain: false, characteristic: 'butterworth' }
        if (f.type === 'bandpass') {
          filterOpt.Fc = Math.sqrt(f.fc[1] * f.fc[0])
          filterOpt.BW = Math.log2(f.fc[1] / f.fc[0])
        } else {
          filterOpt.Fc = f.fc
        }
        const iirFilterCoeffs = iirCalculator[f.type](filterOpt)
        const iirFilter = new Fili.IirFilter(iirFilterCoeffs)
        wf.opt.filtered = iirFilter.simulate(wf.opt.values)
        const taperLength = 4 * fs
        for (let i = 0; i < taperLength; i++) {
          wf.opt.filtered![i] = wf.opt.filtered![i] != null ? wf.opt.filtered![i]! * Math.pow(i / taperLength, 3) : null
        }
      }
      this.picker!.setFilterState(true)
    },

    resetFilter () {
      if (this.list != null) {
        this.list.setFilterState(false)
      }
      if (this.picker != null) {
        this.picker.setFilterState(false)
      }
    },

    ne2rt (wf: WaveformItemOptions) {
      const horizontals = this.getHorizontalWaveforms(wf)
      let [nWf, eWf] = [null, null] as WaveformItemOptions[] | null[]
      if (horizontals.length === 2) {
        [nWf, eWf] = horizontals as WaveformItemOptions[]
      } else {
        console.error('[PickerView::ne2rt] Cannot rotate to RT: no horizontal waveforms.')
        return []
      }
      if (nWf!.step !== eWf!.step) {
        console.error('[PickerView::ne2rt] Cannot rotate to RT: different sampling rates for horizontal components !')
        return []
      }
      const baseId = nWf.id.slice(0, -1)
      const baz = utils.az2baz(nWf.azimuth) * Math.PI / 180
      // sync horizontals
      const start = Math.max(nWf.start, eWf.start)
      const end = Math.min(
        nWf.start + nWf.values.length * nWf.step,
        eWf.start + eWf.values.length * eWf.step
      )
      const iN = Math.floor((start - nWf.start) / nWf.step)
      const iE = Math.floor((start - eWf.start) / eWf.step)
      const nbSamples = Math.floor((end - start) / nWf.step)
      const r = []
      const t = []
      for (let i = 0; i < nbSamples; i++) {
        const [n, e] = [nWf.values[iN + i], eWf.values[iE + i]]
        if (n == null || e == null) {
          r.push(null)
          t.push(null)
          continue
        }
        r.push(-e * Math.sin(baz) - n * Math.cos(baz))
        t.push(-e * Math.cos(baz) + n * Math.sin(baz))
      }
      const wfList = []
      const [rId, tId] = [`${baseId}R`, `${baseId}T`]
      if (this.picks[rId] == null) {
        this.picks[rId] = []
      }
      if (this.picks[tId] == null) {
        this.picks[tId] = []
      }
      wfList.push({
        start: start,
        step: nWf.step,
        values: r,
        scale: -eWf.scale * Math.sin(baz) - nWf.scale * Math.cos(baz),
        id: rId,
        distance: nWf.distance,
        azimuth: nWf.azimuth,
        ttt: nWf.ttt,
        phasenet: nWf.phasenet,
        picks: this.picks[rId]
      })
      wfList.push({
        start: start,
        step: nWf.step,
        values: t,
        scale: -eWf.scale * Math.cos(baz) + nWf.scale * Math.sin(baz),
        id: tId,
        distance: nWf.distance,
        azimuth: nWf.azimuth,
        ttt: nWf.ttt,
        phasenet: nWf.phasenet,
        picks: this.picks[tId]
      })
      return wfList
    },

    getTTT () {
      return new Promise((resolve, reject) => {
        // const stationDistance = Object.assign({}, this.stationDistance)
        const stationCoordinates = Object.assign({}, this.stationCoordinates)

        // cached origin
        const caO = this.$store.state.pickerLastOrigin

        // current origin
        const cuO = {
          latitude: this.origin.latitude.value,
          longitude: this.origin.longitude.value,
          depth: this.origin.depth.value
        }
        this.$store.state.pickerLastOrigin = cuO

        if (
          caO != null &&
          caO.latitude === cuO.latitude &&
          caO.longitude === cuO.longitude &&
          caO.depth === cuO.depth
        ) {
          // current origin == cached origin
          for (const netsta of Object.keys(stationCoordinates)) {
            if (this.ttt[netsta] != null) {
              // As origin is unchanged it is not needed to recompute ttt for station already computed
              delete stationCoordinates[netsta]
            }
          }
          if (Object.keys(stationCoordinates).length === 0) {
            console.log('[PickerView::getTTT] Origin is unchanged, do not recompute theoretical travel times.')
            this.$store.dispatch('log', '[PickerView::getTTT] Origin is unchanged, do not recompute theoretical travel times.')
            resolve(null)
            return
          }
        } else {
          this.ttt = {}
          this.phasenet = {}
        }
        this.$store.dispatch('setLoading', { value: true, text: 'Loading theoretical travel times...' })
        console.log('[PickerView::getTTT] compute theoretical travel time', stationCoordinates)
        this.$store.dispatch('log', '[PickerView::getTTT] compute theoretical travel time')
        const xhr = new XMLHttpRequest()
        this.xhr.push(xhr)
        utils.ajax({
          method: 'POST',
          url: this.$store.getters.getLink('ttt'),
          dataMimeType: 'application/json',
          data: JSON.stringify({
            latitude: cuO.latitude,
            longitude: cuO.longitude,
            depth: cuO.depth / 1000,
            station: stationCoordinates
          }),
          type: 'json'
        }, xhr).then(ttt => {
          this.xhr.splice(this.xhr.indexOf(xhr), 1)

          const t0 = this.origin.time._value.getTime()
          for (const staObj of Object.values(ttt as TheoreticalTravelTimeObject)) {
            for (const [phase, phaseTTT] of Object.entries(staObj.ttt)) {
              staObj.ttt[phase] = t0 + phaseTTT * 1e3
            }
          }
          this.ttt = Object.assign({}, this.ttt, ttt)
          this.$store.dispatch('setLoading', { value: false })
          resolve(null)
        }).catch(data => {
          this.$store.dispatch('log', `[PickerView::getTTT] compute theoretical travel time request failed: ${data}`)
        })
      })
    },

    getTimeWindow () {
      const times = this.origin.arrival.map(a => a._pick.time._value.getTime())
      for (const sta of Object.values(this.ttt)) {
        for (const ttt of Object.values(sta.ttt)) {
          times.push(ttt)
        }
      }
      return [
        new Date(this.origin.time._value.getTime() - 15e3).toISOString().substr(0, 19),
        new Date(Math.max.apply(null, times) + 20e3).toISOString().substr(0, 19)
      ]
    },

    getCachedTraces (fdsnidList: string[]): [Trace[], string[], string] {
      const traceList = [] as Trace[]
      const notCached = [] as string[]
      const [start, end] = this.getTimeWindow()
      const timeCacheKey = `${start.slice(0, 16)}_${end.slice(0, 16)}`
      for (const fdsnid of fdsnidList.map(x => x)) {
        const cacheKey = `${fdsnid}|${timeCacheKey}`
        if (this.trace[cacheKey] == null) {
          notCached.push(fdsnid)
        } else {
          traceList.push(this.trace[cacheKey])
          fdsnidList.splice(fdsnidList.indexOf(fdsnid), 1)
        }
      }
      console.log('[PickerView::getCachedTraces]', { traceList, notCached, timeCacheKey })
      this.$store.dispatch('log', '[PickerView::getCachedTraces]')
      return [traceList, notCached, timeCacheKey]
    },

    getDownloadChunks (fdsnidList: string[]) {
      // sort fdsnidList to retrieve in priority first 10 channels and Z component
      const primary = []; const secondary = []
      for (let i = 0; i < fdsnidList.length; i++) {
        if (i < 10) {
          primary.push(fdsnidList[i])
        } else {
          if (fdsnidList[i].slice(-1) === 'Z') {
            primary.push(fdsnidList[i])
          } else {
            secondary.push(fdsnidList[i])
          }
        }
      }
      fdsnidList = primary.concat(secondary)

      const chunks = []
      for (let i = 0; i < fdsnidList.length; i += 10) {
        chunks.push(fdsnidList.slice(i, i + 10))
      }
      return chunks
    },

    traceDownloader (fdsnidList: string[]) {
      return new Promise((resolve) => {
        console.log('[PickerView::traceDownloader]', fdsnidList)
        this.$store.dispatch('log', `[PickerView::traceDownloader]: ${JSON.stringify(fdsnidList)}`)
        const [start, end] = this.getTimeWindow()
        const xhr = new XMLHttpRequest()
        this.xhr.push(xhr)
        utils.ajax({
          method: 'POST',
          url: this.$store.getters.getLink('fdsnws/dataselect/1/query'),
          dataMimeType: 'text/plain',
          data: fdsnidList.map(fdsnid => `${fdsnid.replace(/\./g, ' ')} ${start} ${end}`).join('\r\n'),
          type: 'arraybuffer'
        }, xhr).then(arr => {
          this.xhr.splice(this.xhr.indexOf(xhr), 1)
          const st = new Stream(new DataView(arr as ArrayBuffer))
          resolve(st.traces)
        }).catch(data => {
          this.$store.dispatch('log', `[PickerView::traceDownloader] failed to download data: ${data}`)
        })
      })
    },

    downloadWaveforms (fdsnidList: string[], dlCallback: (wfList: WaveformItemOptions[]) => void) {
      return new Promise((resolve) => {
        if (fdsnidList.length === 0) {
          resolve(null)
        }
        console.log('[PickerView::downloadWaveforms]', fdsnidList)
        this.$store.dispatch('log', `[PickerView::downloadWaveforms]: ${JSON.stringify(fdsnidList)}`)

        const [traceList, notCached, timeCacheKey] = this.getCachedTraces(fdsnidList) as [Trace[], string[], string]
        if (traceList.length > 0 && dlCallback != null) {
          dlCallback(traceList.map((tr: Trace) => this.getWaveformObject(tr)).filter((wf: WaveformItemOptions | null) => wf != null) as WaveformItemOptions[])
        }
        const chunks = this.getDownloadChunks(notCached)
        if (chunks.length === 0) {
          resolve(null)
        } else {
          let i = 0
          const postDownload = (traceList: Trace[]) => {
            for (const tr of traceList) {
              const fdsnid = tr.stats.id.replace('..', '.--.')
              fdsnidList.splice(fdsnidList.indexOf(fdsnid), 1)
              const cacheKey = `${fdsnid}|${timeCacheKey}`
              this.trace[cacheKey] = tr
            }
            if (dlCallback != null && traceList.length > 0) {
              dlCallback(traceList.map(tr => this.getWaveformObject(tr)).filter((wf: WaveformItemOptions | null) => wf != null) as WaveformItemOptions[])
            }
            this.$store.dispatch('setLoading', { value: false })
            if (i < chunks.length) {
              this.traceDownloader(chunks[i++]).then(traceList => postDownload(traceList as Trace[]))
              this.loading = i * 100 / chunks.length
            } else {
              this.loading = null
              if (fdsnidList.length > 0) {
                const content = fdsnidList.join(', ')
                this.$store.dispatch('notify', { color: 'error', text: `These channels couldn't be retrieved: ${content}` })
                console.log('[PickerView::downloadWaveforms] These channels couldn\'t be retrieved', fdsnidList)
                this.$store.dispatch('log', `[PickerView::downloadWaveforms] These channels couldn't be retrieved: ${JSON.stringify(fdsnidList)}`)
              }
              this.$store.dispatch('notify', { color: 'info', text: 'Waveforms loaded.' })
              resolve(null)
            }
          }
          this.$store.dispatch('setLoading', { value: true, text: `Loading waveforms... (${fdsnidList.length} channels)` })
          this.traceDownloader(chunks[i++]).then(traceList => postDownload(traceList as Trace[]))
        }
      })
    },

    getHorizontalIds (verticalId: string) {
      const baseId = verticalId.replace('.--.', '..').slice(0, -1)
      const ids = [`${baseId}N`, `${baseId}E`, `${baseId}1`, `${baseId}2`, `${baseId}3`]
      const result = []
      for (const id of ids) {
        const cha = this.getChannel(id)
        if (cha != null) {
          result.push(id.replace('..', '.--.'))
        }
      }
      return result
    },

    getAuxiliaryIds (verticalId: string) {
      const baseId = verticalId.replace('.--.', '..').slice(0, -4)
      const ids = [`${baseId}.HDH`]
      const result = []
      for (const id of ids) {
        const cha = this.getChannel(id)
        if (cha != null) {
          result.push(id.replace('..', '.--.'))
        }
      }
      return result
    },

    handleUpdatePick (ev: PickEvent) {
      this.picksDirty = true
      if (ev.action === 'add') {
        for (const p of ev.picks) {
          p.id = this.$store.getters.getId('Pick')
          const t = new Date()
          p.creation_info = {
            agency_id: this.origin.creation_info.agency_id,
            author: this.$store.state.author,
            creation_time: t.toISOString(),
            _creation_time: t,
            _pretty_creation_time: t.toISOString().replace('T', ' ').substr(0, 19)
          }
          if (this.tools.filter != null) {
            p.filter = this.tools.filter.replace(/ /g, '_')
          }
        }
      }
      const zWfid = `${ev.wfid.slice(0, -1)}Z`
      for (const wf of this.list!.waveforms) {
        if (wf.opt.id === zWfid) {
          console.log('[PickerView::handleUpdatePick]', wf)
          this.$store.dispatch('log', '[PickerView::handleUpdatePick]')
          this.list!.drawPicks(wf)
          break
        }
      }
    },

    getColorSettings () {
      const colorSettingKey = Object.keys(this.settings).filter(x => x.indexOf('pickerColor') === 0)
      const result = {} as WaveformColorOptions
      for (const key of colorSettingKey) {
        const optKey = key.split('.')[1]
        result[optKey] = this.settings[key]
      }
      return result
    },

    getRadiusInventory (center: {latitude: number, longitude: number}) {
      return new Promise((resolve) => {
        const strTime = this.origin.time._value.toISOString().slice(0, 19)
        this.$store.dispatch('setLoading', { value: true, text: 'Loading inventory...' })
        utils.ajax({
          method: 'GET',
          url: this.$store.getters.getLink('fdsnws/station/1/query'),
          args: {
            starttime: strTime,
            endtime: strTime,
            level: 'channel',
            format: 'text',
            latitude: center.latitude,
            longitude: center.longitude,
            minradius: 0,
            maxradius: this.tools.stationRadius
          }
        }).then(data => {
          this.$store.dispatch('setLoading', { value: false })
          const inv = utils.parseInventory(data as string)
          console.log('[PickerView::getRadiusInventory] additional station result', inv)
          this.$store.dispatch('log', '[PickerView::getRadiusInventory] additional station result')
          this.$store.dispatch('mergeInventory', inv)
          resolve(inv)
        })
      }).catch(data => {
        this.$store.dispatch('log', `[PickerView::getRadiusInventory] additional station request failed: ${data}`)
      })
    },

    handleChangeLocation (data: {latitude: number, longitude: number}) {
      console.log('[PickerView::handleChangeLocation]', data)
      this.$store.dispatch('log', `[PickerView::handleChangeLocation]: ${JSON.stringify(data)}`)
      const pos = L.latLng(data.latitude, data.longitude)
      const event = this.$store.state.currentEvent
      const tmp1 = JSON.parse(JSON.stringify(this.origin))
      tmp1.public_id = this.$store.getters.getId('Origin')
      tmp1.creation_info.author = this.$store.state.author
      tmp1.latitude.value = pos.lat
      tmp1.longitude.value = pos.lng
      const tmp2 = { origin: [tmp1], pick: event.pick, public_id: 'fakeid' }
      console.log(tmp2)
      utils.processEventData(tmp2)
      const cloned = tmp2.origin[0]
      cloned._is_dirty = true
      cloned._not_committed = true
      event.origin.push(cloned)
      event.preferred_magnitude_id = null
      event._pm = null
      this.$store.dispatch('setCurrentOrigin', cloned)
      for (const netsta of Object.keys(this.stationDistance)) {
        const [net, sta] = netsta.split('.')
        const staPos = [this.inventory[net][sta].lat, this.inventory[net][sta].lon] as L.LatLngTuple
        this.stationDistance[netsta] = utils.m2deg(pos.distanceTo(staPos))
        this.stationCoordinates[netsta] = [staPos[0], staPos[1], this.inventory[net][sta].alt]
        this.stationAzimuth[netsta] = utils.coordinates2azimuth([pos.lat, pos.lng], staPos)
      }
      for (const wf of Object.values(this.waveform)) {
        const netsta = wf.id.split('.').slice(0, 2).join('.')
        wf.distance = this.stationDistance[netsta]
        wf.azimuth = this.stationAzimuth[netsta]
      }
      this.sortWaveforms()
    },

    loadRadiusStation (center: {latitude: number, longitude: number}) {
      this.getRadiusInventory(center).then(inv => {
        const alreadyLoadedStation = this.list != null ? this.list.waveforms.map(x => x.opt.id.split('.').slice(0, 2).join('.')) : []
        const fdsnidList: string [] = []
        const pos = L.latLng([this.origin.latitude.value, this.origin.longitude.value])
        for (const [net, netObj] of Object.entries(inv as WebpickerInventory)) {
          for (const [sta, staObj] of Object.entries(netObj)) {
            const netsta = `${net}.${sta}`
            if (alreadyLoadedStation.indexOf(netsta) < 0) {
              // browse inventory and ignore already loaded station
              const availableChannel = []
              for (const [loc, locObj] of Object.entries(staObj.location)) {
                for (const [cha, chaObj] of Object.entries(locObj)) {
                  if (cha.slice(-1) === 'Z') {
                    const fdsnid = [net, sta, loc === '' ? '--' : loc, cha].join('.')
                    availableChannel.push({ fdsnid, sample_rate: chaObj[0].sample_rate })
                  }
                }
              }
              // select the higher sampling rate of velocimeter in priority
              const sensorTypeOrder = ['H', 'N']
              for (const sensorType of sensorTypeOrder) {
                const sensorChannels = availableChannel.filter(x => x.fdsnid.slice(-2)[0] === sensorType)
                if (sensorChannels.length > 0) {
                  sensorChannels.sort((a, b) => {
                    const aa = a.sample_rate
                    const bb = b.sample_rate
                    return aa < bb ? 1 : aa > bb ? -1 : 0
                  })
                  fdsnidList.push(sensorChannels[0].fdsnid)
                  for (const horizontal of this.getHorizontalIds(sensorChannels[0].fdsnid)) {
                    fdsnidList.push(horizontal)
                  }
                  const degDistance = utils.m2deg(pos.distanceTo([staObj.lat, staObj.lon]))
                  this.stationDistance[netsta] = degDistance
                  this.stationCoordinates[netsta] = [staObj.lat, staObj.lon, staObj.alt]
                  this.stationAzimuth[netsta] = utils.coordinates2azimuth([pos.lat, pos.lng], [staObj.lat, staObj.lon])
                  break
                }
              }
            }
          }
        }
        console.log('[PickerView::loadRadiusStation] fdsnidList', fdsnidList)
        this.$store.dispatch('log', `[PickerView::loadRadiusStation] fdsnidList: ${JSON.stringify(fdsnidList)}`)
        if (fdsnidList.length === 0) {
          this.$store.dispatch('notify', { color: 'info', text: 'No additional station found in this range.' })
          return
        }
        this.getTTT().then(() => {
          this.downloadWaveforms(fdsnidList, wfList => this.setListWaveforms(wfList))
        })
      })
    },

    getChannel (fdsnid: string) {
      const [n, s, l, c] = fdsnid.replace('.--.', '..').split('.')
      if (this.inventory[n] != null &&
          this.inventory[n][s] != null &&
          this.inventory[n][s].location[l] != null &&
          this.inventory[n][s].location[l][c] != null) {
        const t0 = this.origin.time._value
        return this.inventory[n][s].location[l][c].find(c => c.starttime <= t0 && c.endtime >= t0)
      }
      return null
    },

    getChannelScale (fdsnid: string) {
      const cha = this.getChannel(fdsnid)
      return cha != null ? cha.scale : 1
    },

    setAdditionalWaveformsChannels (wfList: WaveformItemOptions[]) {
      const additionalWaveformsChannels = []
      const seedidList = wfList.map(x => x.id)
      const netsta = seedidList[0].split('.').slice(0, 2).join('.')
      // get all picks from this station
      const seedidPicks = Object.entries(this.picks).filter(x => {
        const pnetsta = x[0].split('.').slice(0, 2).join('.')
        return pnetsta === netsta && x[1].length > 0
      }).map(x => x[0])
      // check if all streams that contain picks are in wfList
      for (const seedid of seedidPicks) {
        if (seedidList.indexOf(seedid) < 0) {
          // if not, add it in wfList and in additionalWaveforms
          seedidList.push(seedid)
          const fdsnid = seedid.replace('..', '.--.')
          if (this.waveform[fdsnid] != null) {
            wfList.push(this.waveform[fdsnid])
            utils.pushInObject(this.additionalWaveforms, netsta, fdsnid)
          }
        }
      }
      const [net, sta] = netsta.split('.')
      for (const [loc, locObj] of Object.entries(this.inventory[net][sta].location)) {
        for (const cha of Object.keys(locObj)) {
          const seedid = [net, sta, loc, cha].join('.')
          if (seedidList.indexOf(seedid) < 0) {
            additionalWaveformsChannels.push({ label: seedid, value: false })
          }
        }
      }
      this.additionalWaveformsChannels = additionalWaveformsChannels
    },

    setPickerWaveforms (wfList: WaveformItemOptions[]) {
      console.log('[PickerView::setPickerWaveforms]', wfList)
      this.$store.dispatch('log', '[PickerView::setPickerWaveforms]')
      if (this.tools.rotation !== 'ZRT') {
        this.setAdditionalWaveformsChannels(wfList)
        console.log('[PickerView::setPickerWaveforms] after setAdditionalWaveformsChannels', wfList)
        this.$store.dispatch('log', '[PickerView::setPickerWaveforms] after setAdditionalWaveformsChannels')
      }
      const view = Object.assign({}, this.defaultView)
      let filterState = false
      let phase = null
      if (this.picker != null) {
        Object.assign(view, this.picker.view, { gain: 1 })
        phase = this.picker.event.phase
        filterState = this.picker.event.useFiltered
        this.picker.destroy()
      }
      const height = this.settings['pickerSize.pickerWaveformHeight']
      this.pickerOpt.color = this.getColorSettings()
      this.pickerOpt.size = { height, wrapperMaxHeight: wfList.length * height + 40 }
      this.pickerOpt.equalScale = this.tools.sameScale
      this.pickerOpt.view = view
      this.pickerOpt.waveforms = wfList
      this.picker = new Waveform(this.pickerOpt)
      this.applyFilter(this.picker.waveforms)
      this.picker.setFilterState(filterState)
      this.picker.setPickerPhase(phase as string)
      this.tools.focusComponentOption = wfList.map(x => x.id.slice(-1))
      this.picker.setFocusWaveform(this.tools.focusComponent)
      this.picker.updatePickLine()
    },

    setListWaveforms (wfList: WaveformItemOptions[]) {
      console.log('[PickerView::setListWaveforms]', wfList)
      this.$store.dispatch('log', '[PickerView::setListWaveforms]')
      if (this.list == null) {
        this.listOpt.size = {
          height: this.settings['pickerSize.listWaveformHeight'],
          wrapperMaxHeight: this.settings['pickerSize.listWaveformWrapperHeight']
        }
        this.listOpt.color = this.getColorSettings()
        Object.assign(this.listOpt.view!, { refTime: this.tools.alignment }, this.defaultView)
        wfList.sort((a, b) => {
          const aa = a.distance
          const bb = b.distance
          return aa < bb ? -1 : aa > bb ? 1 : 0
        })
        this.listOpt.waveforms = wfList
        this.list = new Waveform(this.listOpt)
        this.list.selectNext() // this will trigger an event that call 'handleWaveformClick'
      } else {
        this.list.addWaveforms(wfList)
        this.sortWaveforms()
      }
    },

    getHorizontalWaveforms (wf: WaveformItemOptions) {
      const result = []
      const horizontalIds = this.getHorizontalIds(wf.id)
      for (const fdsnid of horizontalIds) {
        const cached = this.waveform[fdsnid]
        if (cached != null) {
          result.push(cached)
        }
      }
      return result
    },

    getAuxiliaryWaveforms (wf: WaveformItemOptions) {
      const result = []
      const auxiliaryIds = this.getAuxiliaryIds(wf.id)
      for (const fdsnid of auxiliaryIds) {
        const cached = this.waveform[fdsnid]
        if (cached != null) {
          result.push(cached)
        }
      }
      return result
    },

    getAdditionalWaveforms (wf: WaveformItemOptions) {
      const result = []
      const netsta = wf.id.split('.').slice(0, 2).join('.')
      if (this.additionalWaveforms[netsta] != null) {
        for (const fdsnid of this.additionalWaveforms[netsta]) {
          const cached = this.waveform[fdsnid]
          if (cached != null) {
            result.push(cached)
          }
        }
      }
      return result
    },

    loadPhasenetPick (wfList: WaveformItemOptions[]) {
      const wf = wfList[0]
      const netsta = wf.id.split('.').slice(0, 2).join('.')
      if (this.phasenet[netsta] != null) {
        return
      }
      console.log('[PickerView::loadPhasenetPick] Loading phasenet picks')
      this.$store.dispatch('log', '[PickerView::loadPhasenetPick] Loading phasenet picks')
      utils.ajax({
        method: 'GET',
        args: {
          wfid: wf.id,
          starttime: new Date(wf.start).toISOString().slice(0, 19),
          endtime: new Date(wf.start + wf.values.length * wf.step).toISOString().slice(0, 19)
        },
        url: 'phasenet',
        type: 'json'
      }).then(data => {
        const picks = data as StringIndexedObject[]
        if (picks.length === 0) {
          this.$store.dispatch('notify', { color: 'warning', text: `No Phasenet picks for ${netsta}` })
        }
        const pn: {phase: string; time: number}[] = []
        for (const pick of picks) {
          pn.push({ phase: pick.phase_type, time: new Date(`${pick.phase_time}000Z`).getTime() })
        }
        this.phasenet[netsta] = pn
        for (const currWf of wfList) {
          currWf.phasenet = pn
        }
        console.log('[PickerView::loadPhasenetPick] phasenet picks loaded, redraw picker')
        this.$store.dispatch('log', '[PickerView::loadPhasenetPick] phasenet picks loaded, redraw picker')
        this.picker!.draw()
        this.list!.draw()
      }).catch(() => {
        this.$store.dispatch('notify', { color: 'error', text: `Failed to load Phasenet picks for ${netsta}` })
      })
    },

    handleWaveformClick (wf: WaveformItemOptions, force = false) {
      if (this.picker != null) {
        if (this.picker.waveforms[0].opt.id === wf.id && !force) {
          return
        }
      }
      let tmpWfList: WaveformItemOptions[] = []
      if (this.tools.rotation === 'ZNE') {
        tmpWfList = [wf]
          .concat(this.getHorizontalWaveforms(wf))
          .concat(this.getAuxiliaryWaveforms(wf))
          .concat(this.getAdditionalWaveforms(wf))
      } else if (this.tools.rotation === 'ZRT') {
        tmpWfList = [wf].concat(this.ne2rt(wf))
      }
      const wfList: WaveformItemOptions[] = []
      for (const wf of tmpWfList) {
        utils.pushUnique(wfList, wf)
      }
      this.tools.sameScale = false
      this.setPickerWaveforms(wfList)
      if (this.tools.phasenet) {
        this.loadPhasenetPick(wfList)
      }
    },

    getWaveformObject (tr: Trace): WaveformItemOptions | null {
      if (this.picks[tr.stats.id] == null) {
        this.picks[tr.stats.id] = []
      }
      const netsta = tr.stats.id.split('.').slice(0, 2).join('.')
      if (this.ttt[netsta] != null) {
        const pn = this.phasenet[netsta] != null ? this.phasenet[netsta] : []
        const wf = {
          start: tr.timeseries[0].starttime,
          step: 1000 / tr.stats.samplingRate,
          values: tr.data,
          scale: this.getChannelScale(tr.stats.id),
          id: tr.stats.id,
          distance: this.stationDistance[netsta],
          azimuth: this.stationAzimuth[netsta],
          ttt: Object.assign({ O: this.origin.time._value.getTime() }, this.ttt[netsta].ttt),
          phasenet: pn,
          picks: this.picks[tr.stats.id]
        }
        this.waveform[tr.stats.id.replace('..', '.--.')] = wf
        return wf
      }
      console.warn(`[PickerView::getWaveformObject] Can't find TTT for ${netsta}, discard waveform`)
      this.$store.dispatch('log', `[PickerView::getWaveformObject] Can't find TTT for ${netsta}, discard waveform`)
      return null
    },

    sortWaveforms () {
      if (this.list != null) {
        if (this.tools.sortBy === 'name') {
          this.list.sortWaveformsBy(x => x.id)
        } else if (this.tools.sortBy === 'distance') {
          this.list.sortWaveformsBy(x => x.distance)
        }
      }
    }

  }
})
</script>

<style>

</style>
