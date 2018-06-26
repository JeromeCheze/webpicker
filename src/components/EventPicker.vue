<template>
  <div v-loading="loading" :element-loading-text="loadingText">
    <el-row>{{ horizontalDownloadStatus }}</el-row>
    <el-row class="toolbar" type="flex" align="middle">
      <el-form :inline="true">
        <el-form-item label="Picker phase:">
          <el-select v-model="tools.phase" style="width: 80px;">
            <el-option
            v-for="item in tools.phaseOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="tools.sameScale">Same scale</el-checkbox>
        </el-form-item>
        <el-form-item label="Filter:">
          <el-select v-model="tools.filter" clearable style="width: 80px;">
            <el-option
            v-for="filter in tools.filterList"
            :key="filter.name"
            :label="filter.name"
            :value="filter.name"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="Alignment:">
          <el-radio-group v-model="tools.alignment">
            <el-radio-button label="O"></el-radio-button>
            <el-radio-button label="P"></el-radio-button>
            <el-radio-button label="S"></el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Sort by:">
          <el-radio-group v-model="tools.sortBy">
            <el-radio-button label="distance"></el-radio-button>
            <el-radio-button label="name"></el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Station radius [°]:">
          <el-input-number :min="0" :max="180" :step=".1" v-model="tools.stationRadius"></el-input-number>
          <el-button @click="loadAdditionalStation" :disabled="disableLoadAdditionalStation">Load stations</el-button>
        </el-form-item>
        <el-form-item label="Rotation:">
          <el-select v-model="tools.rotation" style="width: 80px;">
            <el-option
            v-for="rotation in tools.rotationOptions"
            :key="rotation"
            :label="rotation"
            :value="rotation"
            ></el-option>
          </el-select>
        </el-form-item>
      </el-form>
    </el-row>
    <div class="picker" style="height: 410px;"></div>
    <div class="waveform-list"></div>
  </div>
</template>

<script>
import Waveform from '../lib/waveform.js'
import utils from '../utils/utils.js'
import mseed from '../lib/mseed.js'
import Fili from 'fili'
import L from 'leaflet'

export default {
  props: ['event', 'origin', 'inventory', 'settings'],
  data () {
    return {
      // toolbar variables
      tools: {
        rotationOptions: [
          'ZNE',
          'ZRT'
        ],
        rotation: 'ZNE',
        phaseOptions: [
          { value: '', label: 'No picking' },
          { value: 'P', label: 'P' },
          { value: 'S', label: 'S' }
        ],
        phase: '',
        sameScale: false,
        filter: '',
        lastFilter: null,
        alignment: 'O',
        sortBy: 'distance',
        stationRadius: 1,
        filterList: [
          { name: 'HP 1', type: 'highpass', args: { Fc: 1, gain: 0, preGain: false, order: 4, characteristic: 'butterworth' } },
          { name: 'BP 0.5-8', type: 'bandpass', fc: [.5, 8], args: { gain: 0, preGain: false, order: 4, characteristic: 'butterworth' } },
          { name: 'BP 1-8', type: 'bandpass', fc: [1, 8], args: { gain: 0, preGain: false, order: 4, characteristic: 'butterworth' } },
          { name: 'BP 1-10', type: 'bandpass', fc: [1, 10], args: { gain: 0, preGain: false, order: 4, characteristic: 'butterworth' } },
          { name: 'BP 1-50', type: 'bandpass', fc: [1, 50], args: { gain: 0, preGain: false, order: 4, characteristic: 'butterworth' } },
          { name: 'BP 2-10', type: 'bandpass', fc: [2, 10], args: { gain: 0, preGain: false, order: 4, characteristic: 'butterworth' } },
          { name: 'BP 4-20', type: 'bandpass', fc: [4, 20], args: { gain: 0, preGain: false, order: 4, characteristic: 'butterworth' } },
          { name: 'BP 2-20', type: 'bandpass', fc: [2, 20], args: { gain: 0, preGain: false, order: 4, characteristic: 'butterworth' } },
          { name: 'LP 4', type: 'lowpass', args: { Fc: 4, gain: 0, preGain: false, order: 4, characteristic: 'butterworth' } },
          { name: 'LP 10', type: 'lowpass', args: { Fc: 10, gain: 0, preGain: false, order: 4, characteristic: 'butterworth' } },
          { name: 'LP 25', type: 'lowpass', args: { Fc: 25, gain: 0, preGain: false, order: 4, characteristic: 'butterworth' } }
        ]
      },

      // state variables
      dirty: true,
      loading: true,
      picksDirty: false,
      loadingText: '',
      keyDownBinded: false,
      horizontalDownloadStatus: '',
      disableLoadAdditionalStation: true,
      xhr: [],

      // cache variables
      picks: {},
      ttt: null,
      horizontalWaveformCache: {},
      stationInfoMap: {},

      // instances
      list: null,
      picker: null,

      // constructor options
      defaultView: { duration: 30000, offset: 10000 },
      pickerOpt: {
        mode: 'picker',
        container: '.picker',
        // size: { height: 120 },
        waveforms: [],
        equalScale: true,
        view: {},
        callback: {
          updatePick: (ev) => this.handleUpdatePick(ev),
          draw: view => this.list.setSelectedWaveformWindow(view)
        }
      },
      listOpt: {
        mode: 'list',
        container: '.waveform-list',
        // size: { height: 40 },
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
        setPickerPhaseP () { this.tools.phase = 'P' },
        setPickerPhaseS () { this.tools.phase = 'S' },
        deletePick () { this.picker.deleteSelectedPicks() },
        alignToOrigin () { this.tools.alignment = 'O' },
        alignToP () { this.tools.alignment = 'P' },
        alignToS () { this.tools.alignment = 'S' },
        toggleFilter () { this.tools.filter = this.tools.filter == '' ? this.tools.lastFilter : '' },
        toggleEqualScale () { this.tools.sameScale = !this.tools.sameScale }
      }
    }
  },
  watch: {
    'tools.phase': function(val) {
      if (this.picker != null) {
        this.picker.setPickerPhase(val)
      }
    },
    'tools.sameScale': function(val) {
      if (this.list != null) {
        this.picker.opt.equalScale = val
        this.picker.draw()
      }
    },
    'tools.filter': function(val) {
      if (val && this.picker != null && this.list != null) {
        this.applyFilter()
        // this.list.setFilterState(true)
        // this.picker.setFilterState(true)
      } else {
        this.resetFilter()
      }
    },
    'tools.alignment': function(val) {
      if (this.picker != null && this.list != null) {
        this.list.setTimeAlignment(val)
        this.list.draw()
        this.picker.setTimeAlignment(val)
        this.picker.draw()
      }
    },
    'tools.sortBy': function(val) {
      if (this.list != null) {
        if (val == 'name') {
          this.list.sortWaveformsBy(x => x.id)
        } else if (val == 'distance') {
          this.list.sortWaveformsBy(x => x.distance)
        }
      }
    },
    'tools.rotation': function() {
      this.handleWaveformClick(this.picker.waveforms[0].opt, true)
    },
    origin: function(val) {
      this.dirty = true
    }
  },
  activated () {
    this.picksDirty = false
    if (this.dirty) {
      this.dirty = false
      this.reset()
      let stationDistanceMap = {}
      for (let a of this.origin.arrival) {
        let netsta = a._pick._seedid.split('.').slice(0, 2).join('.')
        stationDistanceMap[netsta] = a.distance
      }
      this.getTTT(stationDistanceMap, () => {
        let [mainWfidList, horizontalWfidList] = this.processArrival()
        this.loading = true
        this.loadingText = `Loading waveforms... (${mainWfidList.length + horizontalWfidList.length} channels)`
        this.downloadWaveforms(
          mainWfidList,
          st => this.plotWaveforms(st),
          () => {
            this.$notify.info({ message: 'Waveform list is loaded.' })
            this.disableLoadAdditionalStation = false
          }
        )
        this.downloadWaveforms(
          horizontalWfidList,
          st => this.handleHorizontalWaveforms(st),
          () => { this.$notify.info({ message: 'All waveforms loading is complete.' }) }
        )
      })
    } else {
      this.updatePicksWeightAndResidual()
    }
    this.redraw()
    if (!this.keyDownBinded) {
      this.keyDownBinded = true
      document.body.addEventListener('keydown', ev => this.handleKeyDown(ev))
    }
  },
  deactivated () {
    if (this.xhr.length > 0) {
      this.dirty = true
      for (let xhr of this.xhr) {
        xhr.abort()
      }
    }
    if (this.picks == null && this.ttt == null) {
      this.dirty = true
      return
    }
    if (this.picksDirty == false) {
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
          _traveltime: new Date(pTime - this.origin.time._value),
          _pick: {
            public_id: p.id,
            evaluation_mode: p.mode,
            phase_hint: p.phase,
            polarity: p.polarity,
            _seedid: seedid,
            _fdsnid: seedid.replace('..', '.--.'),
            time: { value: pTime.toISOString(), _value: pTime },
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
    this.$emit('picker-arrival', arrivals)
  },
  methods: {
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
      let bindedAction = null
      for (let key of keybindings) {
        if (this.settings[key].value == k) {
          bindedAction = key.split('.')[1]
        }
      }
      if (bindedAction != null) {
        // ev.preventDefault()
        this.shortcutAction[bindedAction].call(this)
      }
    },

    updatePicksWeightAndResidual () {
      for (let a of this.origin.arrival) {
        let p = this.picks[a._pick._seedid].find(x => x.id == a.pick_id)
        p.weight = a.time_weight
        p.residual = a.time_residual
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
      this.tools.phase = '',
      this.tools.sameScale = true,
      this.tools.filter = '',
      this.tools.alignment = 'O',
      this.tools.sortBy = 'distance'

      this.horizontalWaveformCache = {}
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
        let filterOpt = Object.assign({ Fs: 1000. / wf.opt.step }, f.args)
        if (f.type == 'bandpass') {
          filterOpt.Fc = Math.sqrt(f.fc[1] * f.fc[0])
          filterOpt.BW = Math.log2(f.fc[1] / f.fc[0])
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
        scale: 1, id: rId,
        distance: nWf.distance, azimuth: nWf.azimuth,
        ttt: nWf.ttt, picks: this.picks[rId]
      })
      wfList.push({
        start: start, step: nWf.step, values: t,
        scale: 1, id: tId,
        distance: nWf.distance, azimuth: nWf.azimuth,
        ttt: nWf.ttt, picks: this.picks[tId]
      })
      return wfList
    },

    getTTT (stationDistanceMap, callback) {
      this.loading = true
      this.loadingText = 'Loading theoretical travel time...'
      let data = {
        depth: this.origin.depth.value/1000,
        station: stationDistanceMap
      }
      const xhr = new XMLHttpRequest()
      this.xhr.push(xhr)
      utils.ajax({
        method: 'POST',
        url: 'ttt',
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

    getEnd () {
      let t0 = this.origin.time._value.getTime()
      let times = this.origin.arrival.map(a => a._pick.time._value.getTime())
      for (let sta of Object.values(this.ttt)) {
        for (let ttt of Object.values(sta.ttt)) {
          times.push(ttt)
        }
      }
      return new Date(Math.max.apply(null, times) + 10000).toISOString().substr(0, 19)
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
          residual: a.time_residual,
          weight: a.time_weight,
          takeoff: a.takeoff_angle
        })
        let zComponent = `${a._pick._seedid.slice(0, -1)}Z`
        if (mainWfidList.indexOf(zComponent) < 0) {
          mainWfidList.push(zComponent)
        }
        for (let fdsnid of this.getHorizontalIds(zComponent)) {
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

    handleHorizontalWaveforms (st) {
      for (let tr of st.trace) {
        let wf = this.getWaveformObject(tr)
        this.horizontalWaveformCache[tr.id.replace('..', '.--.')] = wf
      }
    },

    downloadWaveforms (wfidList, callback, complete) {
      let start = new Date(this.origin.time._value.getTime() - 20000).toISOString().substr(0, 19)
      let end = this.getEnd()
      let chunks = []
      for (let i = 0; i < wfidList.length; i += 10) {
        chunks.push(wfidList.slice(i, i + 10))
      }
      let downloader = (i, chunks) => {
        let chunk = chunks[i++]
        let query = chunk.map(wfid => `${wfid.replace(/\./g, ' ')} ${start} ${end}`)
        const xhr = new XMLHttpRequest()
        this.xhr.push(xhr)
        utils.ajax({
          method: 'POST',
          url: 'fdsnws/dataselect/1/query',
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
          }
          if (callback != null) {
            callback.call(null, st)
          }
          if (i < chunks.length) {
            downloader(i, chunks)
          } else {
            if (wfidList.length > 0) {
              let content = wfidList.map(x => `<li>${x}</li>`).join('')
              this.$notify.error({
                duration: 0,
                dangerouslyUseHTMLString: true,
                message: `These channels couldn't be retrieved:<ul>${content}</ul>`
              })
            }
            if (complete != null) {
              complete.call()
            }
          }
        })
      }
      downloader(0, chunks)
    },

    getHorizontalIds (verticalId) {
      let baseId = verticalId.replace('.--.', '..').slice(0, -1)
      let ids = [ `${baseId}N`, `${baseId}E` ]
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
          p.id = utils.getId('Pick')
        }
      }
      this.list.draw()
    },

    getHorizontalWaveforms (wf) {
      let result = []
      let horizontalIds = this.getHorizontalIds(wf.id)
      for (let fdsnid of horizontalIds) {
        let cached = this.horizontalWaveformCache[fdsnid]
        if (cached != null) {
          result.push(cached)
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
      let sameScale = true
      let wfList = []
      if (this.tools.rotation == 'ZNE') {
        wfList = [wf].concat(this.getHorizontalWaveforms(wf))
      } else if (this.tools.rotation == 'ZRT') {
        sameScale = false
        wfList = [wf].concat(this.ne2rt(wf))
      }
      this.tools.sameScale = sameScale
      this.setPickerWaveforms(wfList)
    },

    getColorSettings () {
      let colorSettingKey = Object.keys(this.settings).filter(x => x.indexOf('pickerColor') == 0)
      let result = {}
      for (let key of colorSettingKey) {
        let optKey = key.split('.')[1]
        result[optKey] = this.settings[key].value
      }
      return result
    },

    setPickerWaveforms (wfList) {
      let view = Object.assign({}, this.defaultView)
      let filterState = false
      let phase = null
      if (this.picker != null) {
        Object.assign(view, this.picker.view, {gain: 1})
        phase = this.picker.event.phase
        filterState = this.picker.event.useFiltered
        this.picker.destroy()
      }
      let height = this.settings['pickerSize.pickerWaveformHeight'].value
      this.pickerOpt.color = this.getColorSettings()
      this.pickerOpt.size = { height: height, wrapperMaxHeight: 3 * height }
      this.pickerOpt.equalScale = this.tools.sameScale,
      this.pickerOpt.view = view
      this.pickerOpt.waveforms = wfList
      this.picker = new Waveform(this.pickerOpt)
      this.applyFilter(this.picker.waveforms)
      this.picker.setFilterState(filterState)
      this.picker.setPickerPhase(phase)
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

    loadAdditionalStation () {
      let kmRadius = (this.tools.stationRadius * 2 * Math.PI * 6371 ) / 360
      console.log(`${kmRadius} km`);
      let alreadyLoadedStation = this.list.waveforms.map(x => x.opt.id.split('.').slice(0, 2).join('.'))
      let pos = L.latLng([this.origin.latitude.value, this.origin.longitude.value])
      let t = this.origin.time._value
      let stationDistanceMap = {}
      let wfidList = []
      for (let [net, n] of Object.entries(this.inventory)) {
        for (let [sta, s] of Object.entries(n)) {
          let netsta = [net, sta].join('.')
          if (alreadyLoadedStation.indexOf(netsta) >= 0) {
            continue
          }
          let kmDistance = pos.distanceTo([s.lat, s.lon]) / 1000.
          if (kmDistance > kmRadius) {
            continue
          }
          let stationWf = null
          for (let [loc, l] of Object.entries(s.location)) {
            let availableChannel = []
            for (let [cha, c] of Object.entries(l)) {
              let tmp = c.filter(x => (
                t >= x.starttime &&
                t <= x.endtime &&
                cha.slice(-1) == 'Z' && x.units == 'M/S'
              ))
              if (tmp.length > 0) {
                availableChannel.push({ channel: cha, sample_rate: tmp[0].sample_rate })
              }
            }
            if (availableChannel.length > 0) {
              availableChannel.sort((a, b) => {
                a = a.sample_rate
                b = b.sample_rate
                return a == b ? 0 : a < b ? -1 : 1
              })
              stationWf = [net, sta, loc, availableChannel.slice(-1)[0].channel].join('.').replace('..', '.--.')
              break
            }
          }
          if (stationWf != null) {
            let degDistance  = (kmDistance * 360) / (2 * Math.PI * 6371)
            this.stationInfoMap[netsta] = {
              distance: degDistance,
              azimuth: utils.coordinates2azimuth([pos.lat, pos.lng], [s.lat, s.lon])
            }
            stationDistanceMap[netsta] = degDistance
            wfidList.push(stationWf)
            for (let wfid of this.getHorizontalIds(stationWf)) {
              wfidList.push(wfid)
            }
          }
        }
      }
      console.log(wfidList);
      if (wfidList.length == 0) {
        this.$notify.info({ message: 'No additional station found in this range.' })
        return
      }
      this.getTTT(stationDistanceMap, () => {
        this.downloadWaveforms(
          wfidList,
          st => this.plotWaveforms(st),
          () => {
            this.$notify.info({ message: 'Loading additional station is complete.' })
            this.disableLoadAdditionalStation = false
          }
        )
      })
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

    setListWaveforms (wfList) {
      let selectedWfId = null
      let height = this.settings['pickerSize.listWaveformHeight'].value
      this.listOpt.size = { height }
      this.listOpt.color = this.getColorSettings()
      Object.assign(this.listOpt.view, {refTime: this.tools.alignment}, this.defaultView)
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
        this.list.selectWaveform(wf)
      }
    },

    plotWaveforms (st) {
      this.loading = false
      let wfList = []
      if (this.list != null) {
        wfList = this.listOpt.waveforms
      }
      for (let tr of st.trace) {
        if (tr.id.slice(-1) != 'Z') {
          let wf = this.getWaveformObject(tr)
          this.horizontalWaveformCache[tr.id.replace('..', '.--.')] = wf
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
