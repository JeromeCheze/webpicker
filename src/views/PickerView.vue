<template>
  <div>
    <progress-bar
      v-model="loading"
      :size="settings['pickerProgressBar.size']"
      :color="settings['pickerProgressBar.color']"
    ></progress-bar>
    <v-toolbar dense :style="{ zIndex: 10 }">
      <v-overflow-btn
        v-model="tools.phase"
        label="Phase"
        :items="tools.phaseOptions"
        hide-details
        clearable
        title="Select phase"
      ></v-overflow-btn>
      <v-divider vertical class="mr-2"></v-divider>

      <v-checkbox v-model="tools.sameScale" label="Same scale" hide-details :style="{ maxWidth: '160px' }"></v-checkbox>
      <v-divider vertical></v-divider>

      <v-overflow-btn
        v-model="tools.filter"
        label="Filter"
        item-text="name"
        :items="tools.filterList"
        hide-details
        clearable
        title="Select filter"
      ></v-overflow-btn>
      <v-divider vertical class="mr-2"></v-divider>

      <v-btn-toggle v-model="tools.alignment">
        <v-btn flat :value="'O'" title="Align by origin time">O</v-btn>
        <v-btn flat :value="'P'" title="Align by theoretical P wave">P</v-btn>
        <v-btn flat :value="'S'" title="Align by theoretical S wave">S</v-btn>
      </v-btn-toggle>
      <v-divider vertical class="mx-2"></v-divider>

      <v-btn-toggle v-model="tools.focusComponent">
        <v-btn flat v-for="(comp, index) in tools.focusComponentOption" :key="index">{{ comp }}</v-btn>
      </v-btn-toggle>
      <v-divider vertical class="mx-2"></v-divider>

      <v-btn-toggle v-model="tools.sortBy">
        <v-btn flat :value="'distance'" title="Sort by distance"><v-icon>mdi-map-marker-distance</v-icon></v-btn>
        <v-btn flat :value="'name'" title="Sort by name"><v-icon>mdi-sort-alphabetical</v-icon></v-btn>
      </v-btn-toggle>
      <v-divider vertical class="mx-2"></v-divider>

      <station-radius-selector
        v-model="tools.stationRadius"
        :disabled="disableLoadAdditionalStation"
        @changeLocation="handleChangeLocation"
        @submit="loadRadiusStation"
      ></station-radius-selector>
      <v-divider vertical></v-divider>

      <v-menu offset-y bottom left :close-on-content-click="false" v-model="additionalWaveformsChannelsMenu">
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" icon title="Add component" :disabled="additionalWaveformsChannels.length == 0">
            <v-icon>mdi-playlist-plus</v-icon>
          </v-btn>
        </template>
        <v-list>
          <v-list-tile @click="" v-for="channel in additionalWaveformsChannels" :key="channel.label">
            <v-list-tile-action>
              <v-checkbox v-model="channel.value"></v-checkbox>
            </v-list-tile-action>
            <v-list-tile-content @click="channel.value = !channel.value">{{ channel.label }}</v-list-tile-content>
          </v-list-tile>
          <v-list-tile>
            <v-list-tile-action></v-list-tile-action>
            <v-list-tile-content>
              <v-btn @click="handleAdditionalWaveformSubmit">Ok</v-btn>
            </v-list-tile-content>
          </v-list-tile>
        </v-list>
      </v-menu>
      <v-divider vertical></v-divider>

      <v-overflow-btn
        v-model="tools.rotation"
        label="Rotation"
        :items="tools.rotationOptions"
        hide-details
        title="Select rotation"
      ></v-overflow-btn>
    </v-toolbar>
    <div class="picker-view__container--picker"></div>
    <div class="picker-view__container--list"></div>
  </div>
</template>

<script>
import Waveform from '@/lib/waveform'
import * as utils from '@/utils/utils'
import mseed from '@/lib/mseed'
import Fili from 'fili'
import L from 'leaflet'

export default {

  data () {
    return {
      loading: null,
      // toolbar variables
      tools: {
        rotationOptions: [ 'ZNE', 'ZRT' ],
        rotation: 'ZNE',
        phaseOptions: [
          { value: 'P', text: 'P' },
          { value: 'S', text: 'S' }
        ],
        focusComponent: 0,
        focusComponentOption: [],
        phase: null,
        sameScale: false,
        filter: null,
        lastFilter: 'HP 1',
        alignment: 'O',
        sortBy: 'distance',
        stationRadius: 1,
        filterList: this.$store.state.settings['picker.filters']
      },

      uncertaintyList: [ null, 0.05, 0.2, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 99.0 ],

      // state variables
      picksDirty: false,
      keyDownBinded: false,
      horizontalDownloadStatus: '',
      disableLoadAdditionalStation: true,
      xhr: [],

      // additional waveforms by station selected by user
      additionalWaveformsChannelsMenu: false,
      additionalWaveformsChannels: [],
      additionalWaveforms: {},

      // cache variables
      picks: {},
      waveform: {},
      stationDistance: {},
      stationAzimuth: {},

      // instances
      list: null,
      picker: null,

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
          updatePick: (ev) => this.handleUpdatePick(ev),
          draw: view => this.list.setSelectedWaveformWindow(view),
          waveformFocus: index => this.tools.focusComponent = index
        }
      },
      listOpt: {
        mode: 'list',
        container: '.picker-view__container--list',
        // size: { height: this.settings['pickerSize.listWaveformHeight'] },
        waveforms: [],
        equalScale: false,
        view: {},
        callback: {
          waveformClick: wf => this.handleWaveformClick(wf)
        }
      },

      // keybinding mapping
      shortcutAction: {
        nextStation () { this.list.selectNext() },
        previousStation () { this.list.selectPrev() },
        setPolarityPositive () { this.picker.setPolarity('positive') },
        setPolarityNegative () { this.picker.setPolarity('negative') },
        setNoPolarity () { this.picker.setPolarity(null) },
        leavePickingMode (ev) { ev.preventDefault() ; this.tools.phase = null },
        setPickerPhaseP () { this.tools.phase = 'P' },
        setPickerPhaseS () { this.tools.phase = 'S' },
        deletePick () { this.picker.deleteSelectedPicks() },
        alignToOrigin () { this.tools.alignment = 'O' },
        alignToP () { this.tools.alignment = 'P' },
        alignToS () { this.tools.alignment = 'S' },
        toggleFilter () { this.tools.filter = this.tools.filter == null ? this.tools.lastFilter : null },
        toggleEqualScale () { this.tools.sameScale = !this.tools.sameScale },
        createPick (ev) { ev.preventDefault(); this.picker.createPick() },
        movePickLineRight () { this.picker.movePickLine({ direction: 'right', fast: false }) },
        moveFastPickLineRight () { this.picker.movePickLine({ direction: 'right', fast: true }) },
        movePickLineLeft () { this.picker.movePickLine({ direction: 'left', fast: false }) },
        moveFastPickLineLeft () { this.picker.movePickLine({ direction: 'left', fast: true }) },
        xZoomIn () { this.picker != null && this.picker.xZoomIn() },
        xZoomOut () { this.picker != null && this.picker.xZoomOut() },
        yZoomIn () { this.picker != null && this.picker.yZoomIn() },
        yZoomOut () { this.picker != null && this.picker.yZoomOut() },
        setFocusComponentZ () { this.tools.focusComponent = 0 },
        setFocusComponentN () { this.tools.focusComponent = 1 },
        setFocusComponentE () { this.tools.focusComponent = 2 },
        setTimeUncertainty0 () { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[0]) },
        setTimeUncertainty1 () { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[1]) },
        setTimeUncertainty2 () { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[2]) },
        setTimeUncertainty3 () { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[3]) },
        setTimeUncertainty4 () { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[4]) },
        setTimeUncertainty5 () { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[5]) },
        setTimeUncertainty6 () { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[6]) },
        setTimeUncertainty7 () { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[7]) },
        setTimeUncertainty8 () { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[8]) },
        setTimeUncertainty9 () { this.picker != null && this.picker.setTimeUncertainty(this.uncertaintyList[9]) }
      }
    }
  },

  computed: {
    origin () {
      return this.$store.state.currentOrigin
    },
    inventory () {
      return this.$store.state.inventory
    },
    settings () {
      return this.$store.state.settings
    },
    ttt: {
      get: function () {
        return this.$store.state.tttCache
      },
      set: function (ttt) {
        this.$store.dispatch('setTTTCache', ttt)
      }
    },
    trace () {
      return this.$store.state.traceCache
    }
  },

  watch: {
    'tools.phase': function (val) {
      utils.blurActiveElement()
      if (this.picker != null) {
        this.picker.setPickerPhase(val)
      }
    },
    'tools.sameScale': function (val) {
      utils.blurActiveElement()
      if (this.list != null) {
        this.picker.opt.equalScale = val
        this.picker.draw()
      }
    },
    'tools.filter': function (val) {
      utils.blurActiveElement()
      if (val && this.picker != null && this.list != null) {
        this.applyFilter()
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
      if (this.picker != null && val != oldVal) {
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
      console.error('[PickerView::mounted] No event found');
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

    let fdsnidList = this.processArrival()
    this.getTTT().then(() => {
      this.downloadWaveforms(fdsnidList, wfList => this.processWaveforms(wfList)).then(() => {
        this.disableLoadAdditionalStation = false
      })
    })
  },

  beforeDestroy () {
    this.$store.dispatch('setLoading', { value: false })
    if (this.xhr.length > 0) {
      for (let xhr of this.xhr) {
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
    if (this.picks == null && this.ttt == null || this.picksDirty == false) {
      return
    }
    let arrivals = []
    for (let [seedid, picks] of Object.entries(this.picks)) {
      let [net, sta, loc, cha] = seedid.split('.')
      let netsta = `${net}.${sta}`
      for (let p of picks) {
        let pTime = new Date(p.time)
        arrivals.push({
          azimuth: this.stationAzimuth[netsta],
          distance: this.stationDistance[netsta],
          phase: p.phase,
          pick_id: p.id,
          time_residual: p.residual,
          takeoff_angle: p.takeoff,
          time_weight: p.weight,
          _traveltime: new Date(pTime.getTime() - this.origin.time._value),
          _pick: {
            public_id: p.id,
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
              location_code: loc == '' ? null : loc,
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
      let fdsnidList = []
      this.origin.arrival.sort((a, b) => {
        a = a.distance
        b = b.distance
        return a == b ? 0 : a < b ? -1 : 1
      })
      this.picks = {}
      for (let [i, a] of this.origin.arrival.entries()) {
        let fdsnid = a._pick._fdsnid
        let netsta = fdsnid.split('.').slice(0, 2).join('.')
        this.stationDistance[netsta] = a.distance
        this.stationAzimuth[netsta] = a.azimuth
        utils.pushInObject(this.picks, a._pick._seedid, {
          id: a.pick_id,
          phase: a.phase,
          mode: a._pick.evaluation_mode,
          polarity: a._pick.polarity,
          time: a._pick.time._value.getTime(),
          lower_uncertainty: a._pick.time.lower_uncertainty,
          upper_uncertainty: a._pick.time.upper_uncertainty,
          residual: a.time_residual,
          weight: a.time_weight,
          takeoff: a.takeoff_angle
        })
        let zComponent = `${fdsnid.slice(0, -1)}Z`
        let wfidList = [zComponent].concat(this.getHorizontalIds(zComponent)).concat(this.getAuxiliaryIds(zComponent))
        for (let fdsnid of wfidList) {
          utils.pushUnique(fdsnidList, fdsnid)
        }
      }
      return fdsnidList
    },

    handleAdditionalWaveformSubmit () {
      this.additionalWaveformsChannelsMenu = false
      let additionalWaveformsChannelsList = this.additionalWaveformsChannels.filter(x => x.value == true).map(x => x.label)
      if (additionalWaveformsChannelsList.length > 0) {
        let netsta = additionalWaveformsChannelsList[0].split('.').slice(0, 2).join('.')
        this.additionalWaveforms[netsta] = additionalWaveformsChannelsList.map(x => x.replace('..', '.--.'))
        this.downloadWaveforms(
          additionalWaveformsChannelsList,
          wfList => this.handleWaveformClick(this.pickerOpt.waveforms[0], true)
        )
      }
    },

    handleKeyDown (ev) {
      let k = utils.shortcutString(ev)
      let keybindings = Object.keys(this.settings).filter(x => x.indexOf('pickerKeybinding') == 0)
      let bindedAction = []
      for (let key of keybindings) {
        if (this.settings[key] == k) {
          bindedAction.push(key.split('.')[1])
        }
      }
      for (let action of bindedAction) {
        this.shortcutAction[action].call(this, ev)
      }
    },

    applyFilter (wfList) {
      if (!this.tools.filter) {
        return
      }
      this.tools.lastFilter = this.tools.filter
      let f = this.tools.filterList.find(x => x.name == this.tools.filter)
      // let f = this.tools.filter
      if (wfList == null) {
        wfList = this.picker.waveforms
        // wfList = this.list.waveforms.concat(this.picker.waveforms)
      }
      let iirCalculator = new Fili.CalcCascades();
      for (let wf of wfList) {
        let filterOpt = { Fs: 1000. / wf.opt.step, order: f.order, gain: 0, preGain: false, characteristic: 'butterworth' }
        if (f.type == 'bandpass') {
          filterOpt.Fc = Math.sqrt(f.fc[1] * f.fc[0])
          filterOpt.BW = Math.log2(f.fc[1] / f.fc[0])
        } else {
          filterOpt.Fc = f.fc
        }
        let iirFilterCoeffs = iirCalculator[f.type](filterOpt)
        let iirFilter = new Fili.IirFilter(iirFilterCoeffs)
        wf.opt.filtered = iirFilter.simulate(wf.opt.values)
      }
      this.picker.setFilterState(true)
    },

    resetFilter () {
      if (this.list != null) {
        this.list.setFilterState(false)
      }
      if (this.picker != null) {
        this.picker.setFilterState(false)
      }
    },

    ne2rt (wf) {
      let horizontals = this.getHorizontalWaveforms(wf)
      let [nWf, eWf] = [null, null]
      if (horizontals.length == 2) {
        [nWf, eWf] = horizontals
      } else {
        console.error('[PickerView::ne2rt] Cannot rotate to RT: no horizontal waveforms.')
        return []
      }
      if (nWf.step != eWf.step) {
        console.error('[PickerView::ne2rt] Cannot rotate to RT: different sampling rates for horizontal components !')
        return []
      }
      let baseId = nWf.id.slice(0, -1)
      let baz = utils.az2baz(nWf.azimuth) * Math.PI / 180
      // sync horizontals
      let start = Math.max(nWf.start, eWf.start),
          end = Math.min(
            nWf.start + nWf.values.length * nWf.step,
            eWf.start + eWf.values.length * eWf.step
          )
      let iN = Math.floor((nWf.start - start) / nWf.step),
          iE = Math.floor((eWf.start - start) / eWf.step)
      let nb_samples = Math.floor((end - start) / nWf.step)
      let r = [],
          t = []
      for (let i = 0; i < nb_samples; i++) {
        let [n, e] = [nWf.values[iN + i], eWf.values[iE + i]]
        if (n == null || e == null) {
          r.push(null)
          t.push(null)
          continue
        }
        r.push(- e * Math.sin(baz) - n * Math.cos(baz))
        t.push(- e * Math.cos(baz) + n * Math.sin(baz))
      }
      let wfList = []
      let [rId, tId] = [`${baseId}R`, `${baseId}T`]
      if (this.picks[rId] == null) {
        this.picks[rId] = []
      }
      if (this.picks[tId] == null) {
        this.picks[tId] = []
      }
      wfList.push({
        start: start, step: nWf.step, values: r,
        scale: -eWf.scale * Math.sin(baz) - nWf.scale * Math.cos(baz),
        id: rId, distance: nWf.distance, azimuth: nWf.azimuth,
        ttt: nWf.ttt, picks: this.picks[rId]
      })
      wfList.push({
        start: start, step: nWf.step, values: t,
        scale: - eWf.scale * Math.cos(baz) + nWf.scale * Math.sin(baz),
        id: tId, distance: nWf.distance, azimuth: nWf.azimuth,
        ttt: nWf.ttt, picks: this.picks[tId]
      })
      return wfList
    },

    getTTT (stationDistanceMap) {
      return new Promise((resolve, reject) => {
        let stationDistance = Object.assign({}, this.stationDistance)

        // cached origin
        let caO = this.$store.state.pickerLastOrigin

        // current origin
        let cuO = {
          latitude: this.origin.latitude.value,
          longitude: this.origin.longitude.value,
          depth: this.origin.depth.value
        }
        this.$store.state.pickerLastOrigin = cuO

        if (
          caO != null &&
          caO.latitude == cuO.latitude &&
          caO.longitude == cuO.longitude &&
          caO.depth == cuO.depth
        ) {
          // current origin == cached origin
          for (let [netsta, dist] of Object.entries(this.stationDistance)) {
            if (this.ttt[netsta] != null) {
              // As origin in unchanged it is not needed to recompute ttt for station already computed
              delete stationDistance[netsta]
            }
          }
          if (Object.keys(stationDistance).length == 0) {
            console.log('[PickerView::getTTT] Origin is unchanged, do not recompute theoretical travel times.')
            resolve()
            return
          }
        } else {
          this.ttt = {}
        }
        this.$store.dispatch('setLoading', { value: true, text: `Loading theoretical travel times...` })
        console.log('[PickerView::getTTT] compute theoretical travel time', stationDistance)
        const xhr = new XMLHttpRequest()
        this.xhr.push(xhr)
        utils.ajax({
          method: 'POST',
          url: this.$store.getters.getLink('ttt'),
          dataMimeType: 'application/json',
          data: JSON.stringify({ depth: cuO.depth / 1000, station: stationDistance }),
          type: 'json'
        }, xhr).then(ttt => {
          this.xhr.splice(this.xhr.indexOf(xhr), 1)

          let t0 = this.origin.time._value.getTime()
          for (let staObj of Object.values(ttt)) {
            for (let [phase, phaseTTT] of Object.entries(staObj.ttt)) {
              staObj.ttt[phase] = t0 + phaseTTT * 1e3
            }
          }
          this.ttt = Object.assign({}, this.ttt, ttt)
          this.$store.dispatch('setLoading', { value: false })
          resolve()
        })
      })
    },

    getTimeWindow () {
      let times = this.origin.arrival.map(a => a._pick.time._value.getTime())
      for (let sta of Object.values(this.ttt)) {
        for (let ttt of Object.values(sta.ttt)) {
          times.push(ttt)
        }
      }
      return [
        new Date(this.origin.time._value.getTime() - 15e3).toISOString().substr(0, 19),
        new Date(Math.max.apply(null, times) + 20e3).toISOString().substr(0, 19)
      ]
    },

    getCachedTraces (fdsnidList) {
      let traceList = []
      let notCached = []
      let [start, end] = this.getTimeWindow()
      let timeCacheKey = `${start.slice(0, 16)}_${end.slice(0, 16)}`
      for (let fdsnid of fdsnidList.map(x => x)) {
        let cacheKey = `${fdsnid}|${timeCacheKey}`
        if (this.trace[cacheKey] == null) {
          notCached.push(fdsnid)
        } else {
          traceList.push(this.trace[cacheKey])
          fdsnidList.splice(fdsnidList.indexOf(fdsnid), 1)
        }
      }
      console.log('[PickerView::getCachedTraces]', { traceList, notCached, timeCacheKey });
      return [traceList, notCached, timeCacheKey]
    },

    getDownloadChunks (fdsnidList) {
      // sort fdsnidList to retrieve in priority first 10 channels and Z component
      let primary = [], secondary = []
      for (let i = 0; i < fdsnidList.length; i++) {
        if (i < 10) {
          primary.push(fdsnidList[i])
        } else {
          if (fdsnidList[i].slice(-1) == 'Z') {
            primary.push(fdsnidList[i])
          } else {
            secondary.push(fdsnidList[i])
          }
        }
      }
      fdsnidList = primary.concat(secondary)

      let chunks = []
      for (let i = 0; i < fdsnidList.length; i += 10) {
        chunks.push(fdsnidList.slice(i, i + 10))
      }
      return chunks
    },

    traceDownloader (fdsnidList) {
      return new Promise((resolve, reject) => {
        console.log('[PickerView::traceDownloader]', fdsnidList)
        let [start, end] = this.getTimeWindow()
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
          let st = new mseed.Stream(new DataView(arr))
          resolve(st.trace)
        })
      })
    },

    downloadWaveforms (fdsnidList, callback) {
      return new Promise((resolve, reject) => {
        if (fdsnidList.length == 0) {
          resolve()
        }
        console.log('[PickerView::downloadWaveforms]', fdsnidList)

        let [traceList, notCached, timeCacheKey] = this.getCachedTraces(fdsnidList)
        if (traceList.length > 0 && callback != null) {
          callback.call(null, traceList.map(tr => this.getWaveformObject(tr)))
        }
        let chunks = this.getDownloadChunks(notCached)
        if (chunks.length == 0) {
          resolve()
        } else {
          let i = 0;
          const postDownload = traceList => {
            for (let tr of traceList) {
              let fdsnid = tr.id.replace('..', '.--.')
              fdsnidList.splice(fdsnidList.indexOf(fdsnid), 1)
              let cacheKey = `${fdsnid}|${timeCacheKey}`
              this.trace[cacheKey] = tr
            }
            if (callback != null && traceList.length > 0) {
              callback.call(null, traceList.map(tr => this.getWaveformObject(tr)))
            }
            this.$store.dispatch('setLoading', { value: false })
            if (i < chunks.length) {
              this.traceDownloader(chunks[i++]).then(traceList => postDownload(traceList))
              this.loading = i * 100 / chunks.length
            } else {
              this.loading = null
              if (fdsnidList.length > 0) {
                let content = fdsnidList.join(', ')
                this.$store.dispatch('notify', { color: 'error', text: `These channels couldn't be retrieved: ${content}` })
                console.log(`[PickerView::downloadWaveforms] These channels couldn't be retrieved`, fdsnidList)
              }
              this.$store.dispatch('notify', { color: 'info', text: 'Waveforms loaded.' })
              resolve()
            }
          }
          this.$store.dispatch('setLoading', { value: true, text: `Loading waveforms... (${fdsnidList.length} channels)` })
          this.traceDownloader(chunks[i++]).then(traceList => postDownload(traceList))
        }
      });
    },

    getHorizontalIds (verticalId) {
      let baseId = verticalId.replace('.--.', '..').slice(0, -1)
      let ids = [ `${baseId}N`, `${baseId}E`, `${baseId}1`, `${baseId}2`, `${baseId}3` ]
      let result = []
      for (let id of ids) {
        let cha = this.getChannel(id)
        if (cha != null) {
          result.push(id.replace('..', '.--.'))
        }
      }
      return result
    },

    getAuxiliaryIds (verticalId) {
      let baseId = verticalId.replace('.--.', '..').slice(0, -4)
      let ids = [ `${baseId}.HDH` ]
      let result = []
      for (let id of ids) {
        let cha = this.getChannel(id)
        if (cha != null) {
          result.push(id.replace('..', '.--.'))
        }
      }
      return result
    },

    handleUpdatePick (ev) {
      this.picksDirty = true
      // console.log(ev);
      if (ev.action == 'add') {
        for (let p of ev.picks) {
          p.id = this.$store.getters.getId('Pick')
        }
      }
      this.list.draw()
    },

    getColorSettings () {
      let colorSettingKey = Object.keys(this.settings).filter(x => x.indexOf('pickerColor') == 0)
      let result = {}
      for (let key of colorSettingKey) {
        let optKey = key.split('.')[1]
        result[optKey] = this.settings[key]
      }
      return result
    },

    getRadiusInventory (center) {
      return new Promise((resolve, reject) => {
        let strTime = this.origin.time._value.toISOString().slice(0, 19)
        this.$store.dispatch('setLoading', { value: true, text: 'Loading inventory...' })
        utils.ajax({
          method: 'GET',
          url: this.$store.getters.getLink('fdsnws/station/1/query'),
          args: {
            starttime: strTime, endtime: strTime,
            level: 'channel', format: 'text',
            latitude: center.latitude,
            longitude: center.longitude,
            minradius: 0, maxradius: this.tools.stationRadius
          }
        }).then(data => {
          this.$store.dispatch('setLoading', { value: false })
          let inv = utils.parseInventory(data)
          console.log('[PickerView::getRadiusInventory] additional station result', inv);
          this.$store.dispatch('mergeInventory', inv)
          resolve(inv)
        })
      })
    },

    handleChangeLocation (data) {
      console.log('[PickerView::handleChangeLocation]', data)
      let pos = L.latLng(data.latitude, data.longitude)
      let event = this.$store.state.currentEvent
      let tmp1 = JSON.parse(JSON.stringify(this.origin))
      tmp1.public_id = this.$store.getters.getId('Origin')
      tmp1.creation_info.author = this.$store.state.author
      tmp1.latitude.value = pos.lat
      tmp1.longitude.value = pos.lng
      let tmp2 = { origin: [tmp1], pick: event.pick }
      console.log(tmp2)
      utils.processEventData(tmp2)
      let cloned = tmp2.origin[0]
      cloned._is_dirty = true
      cloned._not_committed = true
      event.origin.push(cloned)
      event.preferred_magnitude_id = null
      event._pm = null
      this.$store.dispatch('setCurrentOrigin', cloned)
      for (let netsta of Object.keys(this.stationDistance)) {
        let [net, sta] = netsta.split('.')
        let staPos = [this.inventory[net][sta].lat, this.inventory[net][sta].lon]
        this.stationDistance[netsta] = utils.m2deg(pos.distanceTo(staPos))
        this.stationAzimuth[netsta] = utils.coordinates2azimuth([pos.lat, pos.lng], staPos)
      }
      for (let wf of Object.values(this.waveform)) {
        let netsta = wf.id.split('.').slice(0, 2).join('.')
        wf.distance = this.stationDistance[netsta]
        wf.azimuth = this.stationAzimuth[netsta]
      }
      this.sortWaveforms()
    },

    loadRadiusStation (center) {
      this.getRadiusInventory(center).then(inv => {
        let alreadyLoadedStation = this.list != null ? this.list.waveforms.map(x => x.opt.id.split('.').slice(0, 2).join('.')) : []
        let fdsnidList = []
        let stationDistance = {}
        let pos = L.latLng([this.origin.latitude.value, this.origin.longitude.value])
        for (let [net, netObj] of Object.entries(inv)) {
          for (let [sta, staObj] of Object.entries(netObj)) {
            let netsta = `${net}.${sta}`
            if (alreadyLoadedStation.indexOf(netsta) < 0) {
              // browse inventory and ignore already loaded station
              let availableChannel = []
              for (let [loc, locObj] of Object.entries(staObj.location)) {
                for (let [cha, chaObj] of Object.entries(locObj)) {
                  if (cha.slice(-1) == "Z") {
                    let fdsnid = [net, sta, loc == '' ? '--' : loc, cha].join('.')
                    availableChannel.push({ fdsnid, sample_rate: chaObj[0].sample_rate })
                  }
                }
              }
              // select the higher sampling rate of velocimeter in priority
              let sensorTypeOrder = ['H', 'N']
              for (let sensorType of sensorTypeOrder) {
                let sensorChannels = availableChannel.filter(x => x.fdsnid.slice(-2)[0] == sensorType)
                if (sensorChannels.length > 0) {
                  sensorChannels.sort((a, b) => {
                    a = a.sample_rate
                    b = b.sample_rate
                    return a < b ? 1 : a > b ? -1 : 0
                  })
                  fdsnidList.push(sensorChannels[0].fdsnid)
                  for (let horizontal of this.getHorizontalIds(sensorChannels[0].fdsnid)) {
                    fdsnidList.push(horizontal)
                  }
                  let degDistance = utils.m2deg(pos.distanceTo([staObj.lat, staObj.lon]))
                  this.stationDistance[netsta] = stationDistance[netsta] = degDistance
                  this.stationAzimuth[netsta] = utils.coordinates2azimuth([pos.lat, pos.lng], [staObj.lat, staObj.lon])
                  break
                }
              }
            }
          }
        }
        console.log('[PickerView::loadRadiusStation] fdsnidList', fdsnidList);
        if (fdsnidList.length == 0) {
          this.$store.dispatch('notify', { color: 'info', text: 'No additional station found in this range.' })
          return
        }
        this.getTTT(stationDistance).then(() => {
          this.downloadWaveforms(fdsnidList, wfList => this.processWaveforms(wfList))
        })
      })
    },

    getChannel (fdsnid) {
      let [n, s, l, c] = fdsnid.replace('.--.', '..').split('.')
      if (this.inventory[n] != null &&
          this.inventory[n][s] != null &&
          this.inventory[n][s].location[l] != null &&
          this.inventory[n][s].location[l][c] != null) {
        let t0 = this.origin.time._value
        return this.inventory[n][s].location[l][c].find(c => c.starttime <= t0 && c.endtime >= t0)
      }
      return null
    },

    getChannelScale (fdsnid) {
      let cha = this.getChannel(fdsnid)
      return cha != null ? cha.scale : 1
    },

    setAdditionalWaveformsChannels (wfList) {
      let additionalWaveformsChannels = []
      let seedidList = wfList.map(x => x.id)
      let netsta = seedidList[0].split('.').slice(0, 2).join('.')
      // get all picks from this station
      let seedidPicks = Object.entries(this.picks).filter(x => {
        let pnetsta = x[0].split('.').slice(0, 2).join('.')
        return pnetsta == netsta && x[1].length > 0
      }).map(x => x[0])
      // check if all streams that contain picks are in wfList
      for (let seedid of seedidPicks) {
        if (seedidList.indexOf(seedid) < 0) {
          // if not, add it in wfList and in additionalWaveforms
          seedidList.push(seedid)
          let fdsnid = seedid.replace('..', '.--.')
          if (this.waveform[fdsnid] != null) {
            wfList.push(this.waveform[fdsnid])
            utils.pushInObject(this.additionalWaveforms, netsta, fdsnid)
          }
        }
      }
      let [net, sta] = netsta.split('.')
      for (let [loc, locObj] of Object.entries(this.inventory[net][sta].location)) {
        for (let cha of Object.keys(locObj)) {
          let seedid = [net, sta, loc, cha].join('.')
          if (seedidList.indexOf(seedid) < 0) {
            additionalWaveformsChannels.push({ label: seedid, value: false })
          }
        }
      }
      this.additionalWaveformsChannels = additionalWaveformsChannels
    },

    setPickerWaveforms (wfList) {
      console.log('[PickerView::setPickerWaveforms]', wfList)
      if (this.tools.rotation != 'ZRT') {
        this.setAdditionalWaveformsChannels(wfList)
        console.log('[PickerView::setPickerWaveforms] after setAdditionalWaveformsChannels', wfList)
      }
      let view = Object.assign({}, this.defaultView)
      let filterState = false
      let phase = null
      if (this.picker != null) {
        Object.assign(view, this.picker.view, { gain: 1 })
        phase = this.picker.event.phase
        filterState = this.picker.event.useFiltered
        this.picker.destroy()
      }
      let height = this.settings['pickerSize.pickerWaveformHeight']
      this.pickerOpt.color = this.getColorSettings()
      this.pickerOpt.size = { height, wrapperMaxHeight: wfList.length * height + 40 }
      this.pickerOpt.equalScale = this.tools.sameScale,
      this.pickerOpt.view = view
      this.pickerOpt.waveforms = wfList
      this.picker = new Waveform(this.pickerOpt)
      this.applyFilter(this.picker.waveforms)
      this.picker.setFilterState(filterState)
      this.picker.setPickerPhase(phase)
      this.tools.focusComponentOption = wfList.map(x => x.id.slice(-1))
      this.picker.setFocusWaveform(this.tools.focusComponent)
      this.picker.updatePickLine()
    },

    setListWaveforms (wfList) {
      let selectedWfId = null
      this.listOpt.size = { height: this.settings['pickerSize.listWaveformHeight'] }
      this.listOpt.color = this.getColorSettings()
      Object.assign(this.listOpt.view, { refTime: this.tools.alignment }, this.defaultView)
      if (this.list != null) {
        if (this.list.event.selectedWf != null) {
          selectedWfId = this.list.event.selectedWf.opt.id
        }
        Object.assign(this.listOpt.view, this.list.view)
        this.list.destroy()
      }
      let sortKey = this.tools.sortBy == 'name' ? 'id' : 'distance'
      wfList.sort((a, b) => {
        a = a[sortKey]
        b = b[sortKey]
        return a == b ? 0 : a < b ? -1 : 1
      })
      this.listOpt.waveforms = wfList
      this.list = new Waveform(this.listOpt)

      // HERE: indirectly create/update picker instance
      if (selectedWfId == null) {
        this.list.selectNext()
      } else {
        let wf = this.list.waveforms.find(wf => wf.opt.id == selectedWfId)
        this.list.selectWaveform(wf) // this will trigger an event that call 'handleWaveformClick'
      }
    },

    getHorizontalWaveforms (wf) {
      let result = []
      let horizontalIds = this.getHorizontalIds(wf.id)
      for (let fdsnid of horizontalIds) {
        let cached = this.waveform[fdsnid]
        if (cached != null) {
          result.push(cached)
        }
      }
      return result
    },

    getAuxiliaryWaveforms (wf) {
      let result = []
      let auxiliaryIds = this.getAuxiliaryIds(wf.id)
      for (let fdsnid of auxiliaryIds) {
        let cached = this.waveform[fdsnid]
        if (cached != null) {
          result.push(cached)
        }
      }
      return result
    },

    getAdditionalWaveforms (wf) {
      let result = []
      let netsta = wf.id.split('.').slice(0, 2).join('.')
      if (this.additionalWaveforms[netsta] != null) {
        for (let fdsnid of this.additionalWaveforms[netsta]) {
          let cached = this.waveform[fdsnid]
          if (cached != null) {
            result.push(cached)
          }
        }
      }
      return result
    },

    handleWaveformClick (wf, force=false) {
      if (this.picker != null) {
        if (this.picker.waveforms[0].opt.id == wf.id && !force) {
          return
        }
      }
      let wfList = []
      if (this.tools.rotation == 'ZNE') {
        wfList = [wf]
          .concat(this.getHorizontalWaveforms(wf))
          .concat(this.getAuxiliaryWaveforms(wf))
          .concat(this.getAdditionalWaveforms(wf))
      } else if (this.tools.rotation == 'ZRT') {
        wfList = [wf].concat(this.ne2rt(wf))
      }
      this.tools.sameScale = false
      this.setPickerWaveforms(wfList)
    },

    getWaveformObject (tr) {
      if (this.picks[tr.id] == null) {
        this.picks[tr.id] = []
      }
      let netsta = tr.id.split('.').slice(0, 2).join('.')
      let wf = {
        start: tr.timeseries[0].starttime,
        step: 1000 / tr.sample_rate,
        values: tr.getData(),
        scale: this.getChannelScale(tr.id),
        id: tr.id,
        distance: this.stationDistance[netsta],
        azimuth: this.stationAzimuth[netsta],
        ttt: Object.assign({ O: this.origin.time._value.getTime() }, this.ttt[netsta].ttt),
        picks: this.picks[tr.id]
      }
      this.waveform[tr.id.replace('..', '.--.')] = wf
      return wf
    },

    processWaveforms (wfList) {
      if (this.list != null) {
        wfList = wfList.concat(this.listOpt.waveforms)
      }
      let netstaWf = {}
      for (let wf of wfList) {
        let fdsnid = wf.id.replace('..', '.--.')
        let netsta = fdsnid.split('.').slice(0, 2).join('.')
        utils.pushInObject(netstaWf, netsta, wf)
      }
      wfList = []
      let order = ['N', 'H']
      for (let [netsta, netstaList] of Object.entries(netstaWf)) {
        let zChannel = netstaList.filter(x => x.id.slice(-1) == 'Z')
        zChannel.sort((a, b) => {
          a = order.indexOf(a.id.slice(-2)[0])
          b = order.indexOf(b.id.slice(-2)[0])
          return a < b ? 1 : a > b ? -1 : 0
        })
        wfList.push(zChannel[0])
      }
      this.setListWaveforms(wfList)
    },

    sortWaveforms () {
      if (this.list != null) {
        if (this.tools.sortBy == 'name') {
          this.list.sortWaveformsBy(x => x.id)
        } else if (this.tools.sortBy == 'distance') {
          this.list.sortWaveformsBy(x => x.distance)
        }
      }
    }

  }
}
</script>

<style>

</style>
