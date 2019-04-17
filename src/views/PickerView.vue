<template>
  <div>
    <v-toolbar dense :style="{ zIndex: 10 }">
      <v-overflow-btn
        v-model="tools.phase"
        label="Phase"
        :items="tools.phaseOptions"
        hide-details
        clearable
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
      ></v-overflow-btn>
      <v-divider vertical class="mr-2"></v-divider>

      <v-btn-toggle v-model="tools.alignment">
        <v-btn flat :value="'O'">O</v-btn>
        <v-btn flat :value="'P'">P</v-btn>
        <v-btn flat :value="'S'">S</v-btn>
      </v-btn-toggle>
      <v-divider vertical class="mx-2"></v-divider>

      <v-btn-toggle v-model="tools.focusComponent">
        <v-btn flat v-for="(comp, index) in tools.focusComponentOption" :key="index">{{ comp }}</v-btn>
      </v-btn-toggle>
      <v-divider vertical class="mx-2"></v-divider>

      <v-btn-toggle v-model="tools.sortBy">
        <v-btn flat :value="'distance'"><v-icon>mdi-map-marker-distance</v-icon></v-btn>
        <v-btn flat :value="'name'"><v-icon>mdi-sort-alphabetical</v-icon></v-btn>
      </v-btn-toggle>
      <v-divider vertical class="mx-2"></v-divider>

      <number-field v-model="tools.stationRadius" label="Radius" hide-details :style="{ maxWidth: '60px' }"></number-field>
      <v-btn icon @click="loadAdditionalStation" :disabled="disableLoadAdditionalStation">
        <v-icon>mdi-less-than-or-equal</v-icon>
      </v-btn>
      <v-divider vertical></v-divider>

      <v-overflow-btn
        v-model="tools.rotation"
        label="Rotation"
        :items="tools.rotationOptions"
        hide-details
      ></v-overflow-btn>
    </v-toolbar>
    <div class="picker-view__container--picker"></div>
    <div class="picker-view__container--list"></div>
  </div>
</template>

<script>
import Waveform from '@/lib/waveform'
import utils from '@/utils/utils'
import mseed from '@/lib/mseed'
import Fili from 'fili'
import L from 'leaflet'

export default {

  data () {
    return {
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

      // cache variables
      picks: {},
      ttt: null,
      waveformCache: {},
      stationInfoMap: {},

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
    }
  },

  watch: {
    'tools.phase': function (val) {
      this.blurActiveElement()
      if (this.picker != null) {
        this.picker.setPickerPhase(val)
      }
    },
    'tools.sameScale': function (val) {
      this.blurActiveElement()
      if (this.list != null) {
        this.picker.opt.equalScale = val
        this.picker.draw()
      }
    },
    'tools.filter': function (val) {
      this.blurActiveElement()
      if (val && this.picker != null && this.list != null) {
        this.applyFilter()
        // this.list.setFilterState(true)
        // this.picker.setFilterState(true)
      } else {
        this.resetFilter()
      }
    },
    'tools.alignment': function (val) {
      this.blurActiveElement()
      if (this.picker != null && this.list != null) {
        this.list.setTimeAlignment(val)
        this.list.draw()
        this.picker.setTimeAlignment(val)
        this.picker.draw()
      }
    },
    'tools.focusComponent': function (val, oldVal) {
      this.blurActiveElement()
      if (this.picker != null && val != oldVal) {
        this.picker.setFocusWaveform(val)
      }
    },
    'tools.sortBy': function (val) {
      this.blurActiveElement()
      if (this.list != null) {
        if (val == 'name') {
          this.list.sortWaveformsBy(x => x.id)
        } else if (val == 'distance') {
          this.list.sortWaveformsBy(x => x.distance)
        }
      }
    },
    'tools.rotation': function () {
      this.blurActiveElement()
      if (this.picker != null) {
        this.handleWaveformClick(this.picker.waveforms[0].opt, true)
      }
    }
  },

  mounted () {
    this.picksDirty = false
    if (!this.keyDownBinded) {
      this.keyDownBinded = true
      document.body.addEventListener('keydown', this.handleKeyDown)
    }
    let stationDistanceMap = {}
    for (let a of this.origin.arrival) {
      let netsta = a._pick._seedid.split('.').slice(0, 2).join('.')
      stationDistanceMap[netsta] = a.distance
    }
    this.getTTT(stationDistanceMap, () => {
      this.$store.dispatch('setLoading', { value: false })
      let [mainWfidList, horizontalWfidList] = this.processArrival()
      let nbChannels = mainWfidList.length + horizontalWfidList.length
      if (nbChannels > 0) {
        this.$store.dispatch('setLoading', { value: true, text: `Loading waveforms... (${nbChannels} channels)` })
        this.downloadWaveforms(
          mainWfidList,
          st => this.plotWaveforms(st),
          () => {
            this.$store.dispatch('notify', { color: 'info', text: 'Waveform list is loaded.' })
            // this.$notify.info({ message: 'Waveform list is loaded.' })
            // console.log('Waveform list is loaded.');
            this.disableLoadAdditionalStation = false
          }
        )
        this.downloadWaveforms(
          horizontalWfidList,
          st => this.handleHorizontalWaveforms(st),
          () => {
            this.$store.dispatch('notify', { color: 'info', text: 'All waveforms loading is complete.' })
            // this.$notify.info({ message: 'All waveforms loading is complete.' })
            // console.log('All waveforms loading is complete.');
          }
        )
      } else {
        this.disableLoadAdditionalStation = false
      }
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
      let staKey = seedid.split('.').slice(0, 2).join('.')
      let [net, sta, loc, cha] = seedid.split('.')
      if (loc == '') {
        loc = null
      }
      for (let p of picks) {
        let pTime = new Date(p.time)
        arrivals.push({
          azimuth: this.stationInfoMap[staKey].azimuth,
          distance: this.stationInfoMap[staKey].distance,
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
              location_code: loc,
              channel_code: cha
            }
          }
        })
      }
    }
    this.$store.dispatch('pickerData', arrivals)
  },

  methods: {
    blurActiveElement () {
      document.activeElement.blur()
    },

    redraw () {
      if (this.picker != null) {
        this.setPickerWaveforms(this.picker.opt.waveforms)
      }
      if (this.list != null) {
        this.setListWaveforms(this.list.opt.waveforms)
      }
    },

    handleKeyDown (ev) {
      let k = utils.shortcutString(ev)
      console.log(k);
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

    reset () {
      this.disableLoadAdditionalStation = true
      this.listOpt.waveforms = []
      if (this.picker != null) {
        this.picker.destroy()
        this.picker = null
      }
      if (this.list != null) {
        this.list.destroy()
        this.list = null
      }
      this.tools.rotation = 'ZNE',
      this.tools.lastFilter = this.tools.filterList[0].name
      this.tools.phase = null,
      this.tools.sameScale = false,
      this.tools.filter = null,
      this.tools.alignment = 'O',
      this.tools.sortBy = 'distance'

      this.waveformCache = {}
      this.stationInfoMap = {}
      this.picks = null
      this.ttt = null
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
        console.error('Cannot rotate to RT: no horizontal waveforms.')
        return []
      }
      if (nWf.step != eWf.step) {
        console.error('Cannot rotate to RT: different sampling rates for horizontal components !')
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

    getTTT (stationDistanceMap, callback) {
      this.$store.dispatch('setLoading', { value: true, text: 'Loading theoretical travel time...' })
      let data = {
        depth: this.origin.depth.value/1000,
        station: stationDistanceMap
      }
      const xhr = new XMLHttpRequest()
      this.xhr.push(xhr)
      utils.ajax({
        method: 'POST',
        url: this.$store.getters.getLink('ttt'),
        dataMimeType: 'application/json',
        data: JSON.stringify(data),
        type: 'json'
      }, xhr).then(ttt => {
        this.xhr.splice(this.xhr.indexOf(xhr), 1)
        this.ttt = ttt
        let t0 = this.origin.time._value.getTime()
        for (let sta of Object.values(this.ttt)) {
          for (let [k, ttt] of Object.entries(sta.ttt)) {
            sta.ttt[k] = t0 + ttt * 1000
          }
        }
        if (callback != null) {
          callback.call()
        }
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

    processArrival () {
      let mainWfidList = []
      let horizontalWfidList = []
      this.origin.arrival.sort((a, b) => {
        a = a.distance
        b = b.distance
        return a == b ? 0 : a < b ? -1 : 1
      })
      this.picks = {}
      for (let [i, a] of this.origin.arrival.entries()) {
        let seedid = a._pick._seedid
        let netsta = seedid.split('.').slice(0, 2).join('.')
        this.stationInfoMap[netsta] = { azimuth: a.azimuth, distance: a.distance }
        if (this.picks[seedid] == null) {
          this.picks[seedid] = []
        }
        this.picks[seedid].push({
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
        let zComponent = `${a._pick._fdsnid.slice(0, -1)}Z`
        if (mainWfidList.indexOf(zComponent) < 0) {
          mainWfidList.push(zComponent)
        }
        for (let fdsnid of this.getHorizontalIds(zComponent).concat(this.getAuxiliaryIds(zComponent))) {
          if (i < 3) {
            // download horizontal components in main download for the 3 first arrivals
            if (mainWfidList.indexOf(fdsnid) < 0) {
              mainWfidList.push(fdsnid)
            }
          } else {
            if (horizontalWfidList.indexOf(fdsnid) < 0) {
              horizontalWfidList.push(fdsnid)
            }
          }
        }
      }
      return [mainWfidList, horizontalWfidList]
    },

    handleHorizontalWaveforms (traceList) {
      for (let tr of traceList) {
        let wf = this.getWaveformObject(tr)
        this.waveformCache[tr.id.replace('..', '.--.')] = wf
      }
    },

    downloadWaveforms (wfidList, callback, complete) {
      if (wfidList.length == 0) {
        return
      }
      let cache = this.$store.state.waveformCache
      let [start, end] = this.getTimeWindow()
      let cacheKey = `${start.slice(0, 16)}_${end.slice(0, 16)}`
      let traceList = []
      let notCached = []
      for (let fdsnid of wfidList.map(x => x)) {
        if (cache[fdsnid] == null || cache[fdsnid][cacheKey] == null) {
          notCached.push(fdsnid)
        } else {
          traceList.push(cache[fdsnid][cacheKey])
          wfidList.splice(wfidList.indexOf(fdsnid), 1)
        }
      }
      let chunks = []
      for (let i = 0; i < notCached.length; i += 10) {
        chunks.push(notCached.slice(i, i + 10))
      }
      let downloader = (i, chunks) => {
        let chunk = chunks[i++]
        let query = chunk.map(wfid => `${wfid.replace(/\./g, ' ')} ${start} ${end}`)
        const xhr = new XMLHttpRequest()
        this.xhr.push(xhr)
        utils.ajax({
          method: 'POST',
          url: this.$store.getters.getLink('fdsnws/dataselect/1/query'),
          dataMimeType: 'text/plain',
          data: query.join('\r\n'),
          type: 'arraybuffer'
        }, xhr).then(arr => {
          this.xhr.splice(this.xhr.indexOf(xhr), 1)
          let dv = new DataView(arr)
          let st = new mseed.Stream(dv)
          for (let tr of st.trace) {
            let fdsnid = tr.id.replace('..', '.--.')
            wfidList.splice(wfidList.indexOf(fdsnid), 1)
            if (cache[fdsnid] == null) {
              cache[fdsnid] = {}
            }
            cache[fdsnid][cacheKey] = tr
            traceList.push(tr)
          }
          if (callback != null && traceList.length > 0) {
            callback.call(null, traceList)
            traceList = []
          }
          if (i < chunks.length) {
            downloader(i, chunks)
          } else {
            if (wfidList.length > 0) {
              let content = wfidList.join(', ')
              // this.$notify.error({
              //   duration: 0,
              //   dangerouslyUseHTMLString: true,
              //   message: `These channels couldn't be retrieved:<ul>${content}</ul>`
              // })
              this.$store.dispatch('notify', { color: 'error', text: `These channels couldn't be retrieved: ${content}` })
              // console.log(`These channels couldn't be retrieved:\n${content}`);
            }
            if (complete != null) {
              complete.call()
            }
          }
        })
      }
      if (chunks.length == 0) {
        if (callback != null) {
          callback.call(null, traceList)
        }
        if (complete != null) {
          complete.call()
        }
      } else {
        downloader(0, chunks)
      }
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

    getHorizontalWaveforms (wf) {
      let result = []
      let horizontalIds = this.getHorizontalIds(wf.id)
      for (let fdsnid of horizontalIds) {
        let cached = this.waveformCache[fdsnid]
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
        let cached = this.waveformCache[fdsnid]
        if (cached != null) {
          result.push(cached)
        }
      }
      return result
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

    loadAdditionalStation () {
      let alreadyLoadedStation = this.list != null ? this.list.waveforms.map(x => x.opt.id.split('.').slice(0, 2).join('.')) : []
      let strTime = this.origin.time._value.toISOString().slice(0, 19)
      this.$store.dispatch('setLoading', { value: true, text: 'Loading inventory...' })
      utils.ajax({
        method: 'GET',
        url: this.$store.getters.getLink('fdsnws/station/1/query'),
        args: {
          starttime: strTime, endtime: strTime,
          level: 'channel', format: 'text',
          latitude: this.origin.latitude.value,
          longitude: this.origin.longitude.value,
          minradius: 0, maxradius: this.tools.stationRadius
        }
      }).then(data => {
        let inv = utils.parseInventory(data)
        console.log(inv);
        this.$store.dispatch('mergeInventory', inv)
        let wfidList = []
        let stationDistanceMap = {}
        let pos = L.latLng([this.origin.latitude.value, this.origin.longitude.value])
        for (let [net, netObj] of Object.entries(inv)) {
          for (let [sta, staObj] of Object.entries(netObj)) {
            let netsta = `${net}.${sta}`
            if (alreadyLoadedStation.indexOf(netsta) >= 0) {
              continue
            }
            let stationWf = null
            for (let [loc, locObj] of Object.entries(staObj.location)) {
              let availableChannel = []
              for (let [cha, chaObj] of Object.entries(locObj)) {
                availableChannel.push({ channel: cha, sample_rate: chaObj[0].sample_rate })
              }
              availableChannel.sort((a, b) => {
                a = a.sample_rate
                b = b.sample_rate
                return a == b ? 0 : a < b ? -1 : 1
              })
              stationWf = [net, sta, loc, availableChannel.slice(-1)[0].channel].join('.').replace('..', '.--.')
              break
            }
            if (stationWf != null) {
              let degDistance  = ((pos.distanceTo([staObj.lat, staObj.lon]) / 1000.) * 360) / (2 * Math.PI * 6371)
              this.stationInfoMap[netsta] = {
                distance: degDistance,
                azimuth: utils.coordinates2azimuth([pos.lat, pos.lng], [staObj.lat, staObj.lon])
              }
              stationDistanceMap[netsta] = degDistance
              wfidList.push(stationWf)
              for (let wfid of this.getHorizontalIds(stationWf).concat(this.getAuxiliaryIds(stationWf))) {
                wfidList.push(wfid)
              }
            }
          }
        }
        console.log(wfidList);
        if (wfidList.length == 0) {
          this.$store.dispatch('setLoading', { value: false })
          // this.$notify.info({ message: 'No additional station found in this range.' })
          this.$store.dispatch('notify', { color: 'info', text: 'No additional station found in this range.' })
          // console.log('No additional station found in this range.');
          return
        }
        this.getTTT(stationDistanceMap, () => {
          this.downloadWaveforms(
            wfidList,
            st => this.plotWaveforms(st),
            () => {
              // this.$notify.info({ message: 'Loading additional station is complete.' })
              this.$store.dispatch('notify', { color: 'info', text: 'Loading additional station is complete.' })
              // console.log('Loading additional station is complete.');
              this.disableLoadAdditionalStation = false
            }
          )
        })
      })
    },

    getChannel (seedid) {
      let [n, s, l, c] = seedid.split('.')
      if (this.inventory[n] != null &&
          this.inventory[n][s] != null &&
          this.inventory[n][s].location[l] != null &&
          this.inventory[n][s].location[l][c] != null) {
        let t0 = this.origin.time._value
        return this.inventory[n][s].location[l][c].find(c => c.starttime <= t0 && c.endtime >= t0)
      }
      return null
    },

    getChannelScale (seedid) {
      let cha = this.getChannel(seedid)
      return cha != null ? cha.scale : 1
    },

    getWaveformObject (tr) {
      if (this.picks[tr.id] == null) {
        this.picks[tr.id] = []
      }
      let netsta = tr.id.split('.').slice(0, 2).join('.')
      return {
        start: tr.timeseries[0].starttime,
        step: 1000 / tr.sample_rate,
        values: tr.getData(),
        scale: this.getChannelScale(tr.id),
        id: tr.id,
        distance: this.stationInfoMap[netsta].distance,
        azimuth: this.stationInfoMap[netsta].azimuth,
        ttt: Object.assign({ O: this.origin.time._value.getTime() }, this.ttt[netsta].ttt),
        picks: this.picks[tr.id]
      }
    },

    setPickerWaveforms (wfList) {
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
      if (selectedWfId == null) {
        this.list.selectNext()
      } else {
        let wf = this.list.waveforms.find(wf => wf.opt.id == selectedWfId)
        this.list.selectWaveform(wf) // this will trigger an event that call 'handleWaveformClick'
      }
    },

    handleWaveformClick (wf, force=false) {
      if (this.picker != null) {
        if (this.picker.waveforms[0].opt.id == wf.id && !force) {
          return
        }
      }
      let wfList = []
      if (this.tools.rotation == 'ZNE') {
        wfList = [wf].concat(this.getHorizontalWaveforms(wf)).concat(this.getAuxiliaryWaveforms(wf))
      } else if (this.tools.rotation == 'ZRT') {
        wfList = [wf].concat(this.ne2rt(wf))
      }
      this.tools.sameScale = false
      this.setPickerWaveforms(wfList)
    },

    plotWaveforms (traceList) {
      this.$store.dispatch('setLoading', { value: false })
      let wfList = []
      if (this.list != null) {
        wfList = this.listOpt.waveforms
      }
      for (let tr of traceList) {
        if (tr.id.slice(-1) != 'Z') {
          let wf = this.getWaveformObject(tr)
          this.waveformCache[tr.id.replace('..', '.--.')] = wf
        } else {
          wfList.push(this.getWaveformObject(tr))
        }
      }
      this.setListWaveforms(wfList)
      // this.tools.filter = this.tools.filter
    }
  }
}
</script>

<style>
</style>
