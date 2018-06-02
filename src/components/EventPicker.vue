<template>
  <div v-loading="loading" :element-loading-text="loadingText">
    <el-row>{{ horizontalDownloadStatus }}</el-row>
    <el-row class="toolbar" type="flex" align="middle">
      <el-col :span="6">
        <el-select v-model="tools.phase" size="mini">
          <el-option
            v-for="item in tools.phaseOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          ></el-option>
        </el-select>
      </el-col>
      <el-col :span="6">
        <el-checkbox v-model="tools.sameScale" size="mini">Same scale</el-checkbox>
        <el-checkbox v-model="tools.filter" size="mini">Filter HP 1 Hz</el-checkbox>
      </el-col>
      <el-col :span="6">
        <el-radio-group v-model="tools.alignment" size="mini">
          <el-radio-button label="O"></el-radio-button>
          <el-radio-button label="P"></el-radio-button>
          <el-radio-button label="S"></el-radio-button>
        </el-radio-group>
      </el-col>
      <el-col :span="6">
        <el-radio-group v-model="tools.sortBy" size="mini">
          <el-radio-button label="distance"></el-radio-button>
          <el-radio-button label="name"></el-radio-button>
        </el-radio-group>
      </el-col>
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

export default {
  props: ['event', 'origin', 'inventory'],
  data () {
    return {
      // toolbar variables
      tools: {
        phaseOptions: [
          { value: '', label: 'No picking' },
          { value: 'P', label: 'P' },
          { value: 'S', label: 'S' }
        ],
        phase: '',
        sameScale: false,
        filter: false,
        alignment: 'O',
        sortBy: 'distance'
      },

      // state variables
      dirty: true,
      loading: true,
      loadingText: '',
      keyDownBinded: false,
      horizontalDownloadStatus: '',

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
      listOpt: {
        mode: 'list',
        container: '.waveform-list',
        size: { height: 40 },
        waveforms: [],
        view: {},
        callback: {
          waveformClick: wf => this.handleWaveformClick(wf)
        }
      },
      pickerOpt: {
        mode: 'picker',
        container: '.picker',
        size: { height: 120 },
        waveforms: [],
        equalScale: true,
        view: {},
        callback: {
          updatePick: (ev) => this.handleUpdatePick(ev),
          draw: (t1, t2) => this.list.setSelectedWaveformWindow(t1, t2)
        }
      },

      // keybinding mapping
      shortcut: {
        'ArrowDown' () { this.list.selectNext() },
        'ArrowUp' () { this.list.selectPrev() },
        'shift+ArrowUp' () { this.picker.setPolarity('positive') },
        'shift+ArrowDown' () { this.picker.setPolarity('negative') },
        'Escape' () { this.picker.setPolarity(null) },
        'p' () { this.tools.phase = 'P' },
        's' () { this.tools.phase = 'S' },
        'Delete' () { this.picker.deleteSelectedPicks() },
        'Backspace' () { this.picker.deleteSelectedPicks() },
        'alt+o' () { this.tools.alignment = 'O' },
        'alt+p' () { this.tools.alignment = 'P' },
        'alt+s' () { this.tools.alignment = 'S' },
        'f' () { this.tools.filter = !this.tools.filter },
        '=' () { this.tools.sameScale = !this.tools.sameScale }
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
        this.list.opt.equalScale = val
        this.list.draw()
      }
    },
    'tools.filter': function(val) {
      if (val && this.picker != null && this.list != null) {
        this.applyFilter()
        this.list.setFilterState(true)
        this.picker.setFilterState(true)
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
    event: function(val) {
      this.dirty = true
    }
  },
  activated () {
    if (this.dirty) {
      this.dirty = false
      this.reset()
      this.getTTT(() => {
        let [mainWfidList, horizontalWfidList] = this.processArrival()
        this.loading = true
        this.loadingText = `Loading waveforms... (${mainWfidList.length} channels)`
        this.downloadWaveforms(
          mainWfidList,
          st => this.plotWaveforms(st),
          () => {
            this.$notify({
              message: 'Waveform list loading complete.',
              type: 'info'
            })
          }
        )
        this.downloadWaveforms(
          horizontalWfidList,
          st => this.handleHorizontalWaveforms(st),
          () => {
            this.$notify({
              message: 'All waveforms loading complete.',
              type: 'info'
            })
          }
        )
      })
    }
    if (!this.keyDownBinded) {
      this.keyDownBinded = true
      document.body.addEventListener('keydown', ev => this.handleKeyDown(ev))
    }
  },
  deactivated () {
    let arrivals = []
    for (let [wfid, picks] of Object.entries(this.picks)) {
      let staKey = wfid.split('.').slice(0, 2).join('.')
      let [net, sta, loc, cha] = wfid.replace('..', '.--.').split('.')
      for (let p of picks) {
        let pTime = new Date(p.time)
        arrivals.push({
          azimuth: this.stationInfoMap[staKey].azimuth,
          distance: this.stationInfoMap[staKey].distance,
          phase: p.phase,
          pickID: p.id,
          time: new Date(pTime - this.origin.time.value),
          timeResidual: (p.time - this.ttt[staKey].ttt[p.phase]) / 1000,
          timeWeight: p.weight,
          pick: {
            $publicID: p.id,
            evaluationMode: p.mode,
            phaseHint: p.phase,
            polarity: p.polarity,
            seedid: wfid,
            time: { value: pTime },
            timeWeight: p.weight,
            waveformID: {
              $networkCode: net,
              $stationCode: sta,
              $locationCode: loc,
              $channelCode: cha
            }
          }
        })
      }
    }
    this.$emit('picker-arrival', arrivals)
  },
  methods: {
    handleKeyDown (ev) {
      let k = []
      let keyCode = ev.keyCode || ev.which || ev.charCode
      if (ev.metaKey) k.push('meta')
      if (ev.ctrlKey) k.push('ctrl')
      if (ev.altKey) k.push('alt')
      if (ev.shiftKey) k.push('shift')
      if (keyCode >= 48 && keyCode <= 126) {
        k.push(String.fromCharCode(keyCode).toLowerCase())
      } else {
        k.push(ev.key)
      }
      k = k.join('+')
      // console.log(k, ev);
      let bindedAction = this.shortcut[k]
      if (bindedAction != null) {
        ev.preventDefault()
        bindedAction.call(this)
      }
    },

    reset () {
      this.listOpt.waveforms = []
      if (this.picker != null) {
        this.picker.destroy()
        this.picker = null
      }
      if (this.list != null) {
        this.list.destroy()
        this.list = null
      }
      this.tools.phase = '',
      this.tools.sameScale = false,
      this.tools.filter = false,
      this.tools.alignment = 'O',
      this.tools.sortBy = 'distance'

      this.horizontalWaveformCache = {}
      this.stationInfoMap = {}
      this.picks = {}
      this.ttt = null
    },

    applyFilter (wfList) {
      if (!this.tools.filter) {
        return
      }
      let iirCalculator = new Fili.CalcCascades();
      if (wfList == null) {
        wfList = this.list.waveforms.concat(this.picker.waveforms)
      }
      for (let wf of wfList) {
        // let iirFilterCoeffs = iirCalculator.highpass({
        //   characteristic: 'butterworth',
        //   order: 4, Fs: 1000. / wf.opt.step, Fc: 1,
        //   gain: 0, preGain: false
        // })
        let [fc1, fc2] = [5, 20]
        let iirFilterCoeffs = iirCalculator.highpass({
          characteristic: 'butterworth',
          order: 4, Fs: 1000. / wf.opt.step,
          Fc: (fc2-fc1)/2 + fc1,
          BW: fc2-fc1,
          gain: 0, preGain: false
        })
        let iirFilter = new Fili.IirFilter(iirFilterCoeffs)
        wf.opt.filtered = iirFilter.simulate(wf.opt.values)
      }
    },

    resetFilter () {
      if (this.list != null) {
        this.list.setFilterState(false)
      }
      if (this.picker != null) {
        this.picker.setFilterState(false)
      }
    },

    getTTT (callback) {
      this.loading = true
      this.loadingText = 'Loading theoretical travel time...'
      let data = {
        depth: this.origin.depth.value/1000,
        station: {}
      }
      for (let a of this.origin.arrival) {
        let tttId = a.pick.seedid.split('.').slice(0, 2).join('.')
        data.station[tttId] = a.distance
      }
      utils.ajax({
        method: 'POST',
        url: 'ttt',
        dataMimeType: 'application/json',
        data: JSON.stringify(data),
        type: 'json'
      }).then(ttt => {
        this.ttt = ttt
        let t0 = this.origin.time.value.getTime()
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
      let t0 = this.origin.time.value.getTime()
      let times = this.origin.arrival.map(a => a.pick.time.value.getTime())
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
      for (let [i, a] of this.origin.arrival.entries()) {
        let seedid = a.pick.seedid.replace('--', '')
        let staKey = seedid.split('.').slice(0, 2).join('.')
        this.stationInfoMap[staKey] = { azimuth: a.azimuth, distance: a.distance }
        if (this.picks[seedid] == null) {
          this.picks[seedid] = []
        }
        this.picks[seedid].push({
          id: a.pickID,
          phase: a.phase,
          mode: a.pick.evaluationMode,
          polarity: a.pick.polarity,
          time: a.pick.time.value.getTime(),
          weight: a.timeWeight
        })
        let zComponent = `${a.pick.seedid.slice(0, -1)}Z`
        if (mainWfidList.indexOf(zComponent) < 0) {
          mainWfidList.push(zComponent)
        }
        for (let wfid of this.getHorizontalIds(zComponent)) {
          if (i < 3) {
            if (mainWfidList.indexOf(wfid) < 0) {
              mainWfidList.push(wfid)
            }
          } else {
            if (horizontalWfidList.indexOf(wfid) < 0) {
              horizontalWfidList.push(wfid)
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
      let start = new Date(this.origin.time.value.getTime() - 20000).toISOString().substr(0, 19)
      let end = this.getEnd()
      let chunks = []
      for (let i = 0; i < wfidList.length; i += 10) {
        chunks.push(wfidList.slice(i, i + 10))
      }
      for (let [i, chunk] of chunks.entries()) {
        let query = chunk.map(wfid => `${wfid.replace(/\./g, ' ')} ${start} ${end}`)
        utils.ajax({
          method: 'POST',
          url: 'fdsnws/dataselect/1/query',
          dataMimeType: 'text/plain',
          data: query.join('\r\n'),
          type: 'arraybuffer'
        }).then(arr => {
          let dv = new DataView(arr)
          let st = new mseed.Stream(dv)
          for (let tr of st.trace) {
            let wfid = tr.id.replace('..', '.--.')
            wfidList.splice(wfidList.indexOf(wfid))
          }
          if (callback != null) {
            callback.call(null, st)
          }
          if (i >= chunks.length - 1) {
            console.log('Not retrieved waveforms', wfidList);
            if (complete != null) {
              complete.call()
            }
          }
        })
      }
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
      if (this.picks[ev.wfid] == null) {
        this.picks[ev.wfid] = []
      }
      let dest = this.picks[ev.wfid]
      if (ev.action == 'add') {
        for (let p of ev.picks) {
          dest.push(p)
        }
      } else if (ev.action == 'update') {
        for (let p of ev.picks) {
          let oldPick = dest.find(x => x.id == p.id)
          let i = dest.indexOf(oldPick)
          dest.splice(i, 1, p)
        }
      } else if (ev.action == 'delete') {
        for (let p of ev.picks) {
          let oldPick = dest.find(x => x.id == p.id)
          let i = dest.indexOf(oldPick)
          dest.splice(i, 1)
        }
      }
      this.list.draw()
    },

    handleWaveformClick (wf) {
      let view = Object.assign({}, this.defaultView)
      let filterState = false
      let phase = null
      if (this.picker != null) {
        Object.assign(view, this.picker.view, {gain: 1})
        phase = this.picker.event.phase
        filterState = this.picker.event.useFiltered
        this.picker.destroy()
      }
      this.pickerOpt.view = view
      this.pickerOpt.waveforms = [wf]
      let horizontalIds = this.getHorizontalIds(wf.id)
      for (let id of horizontalIds) {
        let cached = this.horizontalWaveformCache[id]
        if (cached != null) {
          this.pickerOpt.waveforms.push(cached)
        }
      }
      this.picker = new Waveform(this.pickerOpt)
      this.applyFilter(this.picker.waveforms)
      this.picker.setFilterState(filterState)
      this.picker.setPickerPhase(phase)
    },

    getChannel (seedid) {
      let [net, sta, loc, cha] = seedid.split('.')
      if (this.inventory[net] != null &&
          this.inventory[net][sta] != null &&
          this.inventory[net][sta][loc] != null &&
          this.inventory[net][sta][loc][cha] != null) {
        let t0 = this.origin.time.value
        return this.inventory[net][sta][loc][cha].find(c => c.starttime <= t0 && c.endtime >= t0)
      }
      return null
    },

    getChannelScale (seedid) {
      let cha = this.getChannel(seedid)
      return cha != null ? cha.scale : 1
    },

    getWaveformObject (tr) {
      let tttId = tr.id.split('.').slice(0, 2).join('.')
      return {
        start: tr.timeseries[0].starttime,
        step: 1000 / tr.sample_rate,
        values: tr.getData(),
        scale: this.getChannelScale(tr.id),
        id: tr.id,
        distance: this.stationInfoMap[tttId].distance,
        azimuth: this.stationInfoMap[tttId].azimuth,
        ttt: Object.assign({ O: this.origin.time.value.getTime() }, this.ttt[tttId].ttt),
        picks: this.picks[tr.id]
      }
    },

    plotWaveforms (st) {
      this.loading = false
      let waveforms = []
      let selectedWfId = null
      Object.assign(this.listOpt.view, {refTime: this.tools.alignment}, this.defaultView)
      if (this.list != null) {
        waveforms = this.listOpt.waveforms
        if (this.list.event.selectedWf != null) {
          selectedWfId = this.list.event.selectedWf.opt.id
        }
        Object.assign(this.listOpt.view, this.list.view)
        this.list.destroy()
      }
      for (let tr of st.trace) {
        if (tr.id.slice(-1) != 'Z') {
          let wf = this.getWaveformObject(tr)
          this.horizontalWaveformCache[tr.id.replace('..', '.--.')] = wf
        } else {
          waveforms.push(this.getWaveformObject(tr))
        }
      }
      let sortKey = this.tools.sortBy == 'name' ? 'id' : 'distance'
      waveforms.sort((a, b) => {
        a = a[sortKey]
        b = b[sortKey]
        return a == b ? 0 : a < b ? -1 : 1
      })
      this.listOpt.waveforms = waveforms
      this.listOpt.equalScale = this.tools.sameScale
      this.list = new Waveform(this.listOpt)
      if (selectedWfId == null) {
        this.list.selectNext()
      } else {
        let wf = this.list.waveforms.find(wf => wf.opt.id == selectedWfId)
        this.list.selectWaveform(wf)
      }
      this.tools.filter = this.tools.filter
    }
  }
}
</script>

<style>
.toolbar {
  padding: 10px;
  background: #f3f3f3;
  border-radius: 4px;
  margin-bottom: 10px;
}
</style>
