<template>
  <div v-loading="loading" :element-loading-text="loadingText">
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
  props: ['origin', 'inventory'],
  data () {
    return {
      keyDownBinded: false,
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
      dirty: true,
      loading: true,
      loadingText: '',
      picks: {},
      picker: null,
      list: null,
      ttt: null,
      defaultView: { duration: 30000, offset: 10000 },
      listOpt: {
        mode: 'list',
        container: '.waveform-list',
        size: { height: 40 },
        waveforms: [],
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
        callback: {
          updatePick: () => this.list.draw(),
          draw: (t1, t2) => this.list.setSelectedWaveformWindow(t1, t2)
        }
      },
      horizontalWaveformCache: {},
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
      this.picker.setPickerPhase(val)
    },
    'tools.sameScale': function(val) {
      this.list.opt.equalScale = val
      this.list.draw()
      // for (let wf of this.list.waveforms) {
      //   let amp = (wf.stats.max - wf.stats.min) / wf.opt.scale
      //   console.log(wf.opt.id, amp.toExponential(3), wf.drawOpt.scaleGain);
      // }
    },
    'tools.filter': function(val) {
      if (val) {
        this.applyFilter()
        this.list.setFilterState(true)
        this.picker.setFilterState(true)
      } else {
        this.resetFilter()
      }
    },
    'tools.alignment': function(val) {
      this.list.setTimeAlignment(val)
      this.list.draw();
      this.picker.setTimeAlignment(val)
      this.picker.draw();
    },
    'tools.sortBy': function(val) {
      if (val == 'name') {
        this.list.sortWaveformsBy(x => x.id)
      } else if (val == 'distance') {
        this.list.sortWaveformsBy(x => x.distance)
      }
    },
    origin: function(val) {
      this.dirty = true
    }
  },
  activated () {
    if (this.dirty) {
      this.dirty = false
      // this.tools.alignment = 'O'
      this.horizontalWaveformCache = {}
      this.tools.filter = false
      if (this.picker != null) {
        this.picker.destroy()
        this.picker = null
      }
      if (this.list != null) {
        this.list.destroy()
        this.list = null
      }
      this.getTTT()
    }
    if (!this.keyDownBinded) {
      this.keyDownBinded = true
      document.body.addEventListener('keydown', ev => this.handleKeyDown(ev))
    }
  },
  deactivated () {
    // TODO: export arrivals
    // let waveforms = this.list.waveforms.map(x => x.opt).concat(Object.values(this.horizontalWaveformCache))
    // let arrivals = []
    // for (let wf of this.list.waveforms) {
    //   for (let p of wf.opt.picks)
    //     arr
    //   }
    // }
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

    applyFilter (wfList) {
      if (!this.tools.filter) {
        return
      }
      let iirCalculator = new Fili.CalcCascades();
      if (wfList == null) {
        wfList = this.list.waveforms.concat(this.picker.waveforms)
      }
      for (let wf of wfList) {
        let iirFilterCoeffs = iirCalculator.highpass({
          characteristic: 'butterworth',
          order: 4, Fs: 1000. / wf.opt.step, Fc: 1,
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

    getTTT () {
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
        this.processArrival()
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
      let wfidList = []
      for (let a of this.origin.arrival) {
        let seedid = a.pick.seedid.replace('--', '')
        if (this.picks[seedid] == null) {
          this.picks[seedid] = []
        }
        this.picks[seedid].push({
          phase: a.phase,
          mode: a.pick.evaluationMode,
          time: a.pick.time.value.getTime()
        })
        if (seedid.slice(-1)[0] == 'Z') {
          wfidList.push(a.pick.seedid)
        }
      }
      this.downloadWaveforms(wfidList, arr => this.plotWaveforms(arr))
    },

    downloadWaveforms (wfidList, callback) {
      this.loading = true
      let start = new Date(this.origin.time.value.getTime() - 20000).toISOString().substr(0, 19)
      let end = this.getEnd()
      let query = []
      for (let wfid of wfidList) {
        query.push(`${wfid.replace(/\./g, ' ')} ${start} ${end}`)
      }
      this.loadingText = `Loading waveforms... (${query.length} channels)`
      utils.ajax({
        method: 'POST',
        url: 'fdsnws/dataselect/1/query',
        dataMimeType: 'text/plain',
        data: query.join('\r\n'),
        type: 'arraybuffer'
      }).then(callback)
    },

    getHorizontalIds (verticalId) {
      let baseId = verticalId.slice(0, -1)
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

    handleWaveformClick (wf) {
      let view = Object.assign({}, this.defaultView)
      let filterState = false
      let phase = null
      if (this.picker != null) {
        view = this.picker.view
        phase = this.picker.event.phase
        filterState = this.picker.event.useFiltered
        this.picker.destroy()
      }
      this.pickerOpt.waveforms = [wf]
      let horizontalIds = this.getHorizontalIds(wf.id)
      // console.log(horizontalIds);
      let toDownload = []
      for (let id of horizontalIds) {
        let cached = this.horizontalWaveformCache[id]
        if (cached != null) {
          this.pickerOpt.waveforms.push(cached)
        } else {
          toDownload.push(id)
        }
      }
      if (toDownload.length > 0) {
        this.downloadWaveforms(toDownload, arr => {
          this.loading = false
          let dv = new DataView(arr)
          let st = new mseed.Stream(dv)
          for (let id of toDownload) {
            let tr = st.getTrace(id.replace('--', ''))
            if (tr != null) {
              let wf = this.getWaveformObject(tr)
              this.horizontalWaveformCache[tr.id.replace('..', '.--.')] = wf
              this.pickerOpt.waveforms.push(wf)
            }
          }
          this.picker = new Waveform(this.pickerOpt)
          Object.assign(this.picker.view, view, {gain: 1})
          this.applyFilter(this.picker.waveforms)
          this.picker.setFilterState(filterState)
          this.picker.setPickerPhase(phase)
        })
      } else {
        this.picker = new Waveform(this.pickerOpt)
        Object.assign(this.picker.view, view, {gain: 1})
        this.applyFilter(this.picker.waveforms)
        this.picker.setFilterState(filterState)
        this.picker.setPickerPhase(phase)
      }
    },

    getChannel (seedid) {
      let [net, sta, loc, cha] = seedid.split('.')
      if (this.inventory[net] != null &&
          this.inventory[net][sta] != null &&
          this.inventory[net][sta][loc] != null &&
          this.inventory[net][sta][loc][cha] != null) {
        return this.inventory[net][sta][loc][cha]
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
        distance: this.ttt[tttId].distance,
        ttt: Object.assign({ O: this.origin.time.value.getTime() }, this.ttt[tttId].ttt),
        picks: this.picks[tr.id]
      }
    },

    plotWaveforms (arr) {
      this.loading = false
      let dv = new DataView(arr)
      let st = new mseed.Stream(dv)
      window.st = st
      this.listOpt.waveforms = []
      for (let tr of st.trace) {
        this.listOpt.waveforms.push(this.getWaveformObject(tr))
      }
      this.list = new Waveform(this.listOpt)
      this.list.view.duration = this.defaultView.duration
      this.list.view.offset = this.defaultView.offset
      this.list.draw()
      this.list.sortWaveformsBy(x => x.distance)
      this.list.selectNext()
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
