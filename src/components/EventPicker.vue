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
    <div class="picker"></div>
    <div class="waveform-list"></div>
  </div>
</template>

<script>
import Waveform from '../lib/waveform.js'
import utils from '../utils/utils.js'
import mseed from '../lib/mseed.js'

export default {
  props: ['origin'],
  data () {
    return {
      tools: {
        phaseOptions: [
          { value: '', label: 'No picking' },
          { value: 'P', label: 'P' },
          { value: 'S', label: 'S' }
        ],
        phase: '',
        sameScale: false,
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
          updatePick: () => this.list.draw()
        }
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
  },
  methods: {
    getTTT () {
      this.loading = true
      this.loadingText = 'Loading theoretical travel time...'
      let data = {
        depth: this.origin.depth.value/1000,
        station: {}
      }
      for (let a of this.origin.arrival) {
        let seedid = a.pick.seedid.replace('--', '')
        data.station[seedid] = a.distance
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
        this.downloadWaveform()
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
      return new Date(Math.max.apply(null, times) + 10000).toISOString()
    },
    downloadWaveform () {
      let start = new Date(this.origin.time.value.getTime() - 20000).toISOString()
      let end = this.getEnd()
      let query = []
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
        query.push(`${a.pick.seedid.replace(/\./g, ' ')} ${start} ${end}`)
      }
      this.loadingText = `Loading waveforms... (${query.length} channels)`
      utils.ajax({
        method: 'POST',
        url: 'fdsnws/dataselect/1/query',
        dataMimeType: 'text/plain',
        data: query.join('\n'),
        type: 'arraybuffer'
      }).then(arr => this.plotWaveforms(arr))
    },
    handleWaveformClick (wf) {
      let view = Object.assign({}, this.defaultView)
      let phase = null
      if (this.picker != null) {
        view = this.picker.view
        phase = this.picker.event.phase
        this.picker.destroy()
      }
      this.pickerOpt.waveforms = [wf]
      this.picker = new Waveform(this.pickerOpt)
      Object.assign(this.picker.view, view)
      this.picker.draw()
      this.picker.setPickerPhase(phase)
    },
    plotWaveforms (arr) {
      this.loading = false
      let dv = new DataView(arr)
      let st = new mseed.Stream(dv)
      window.st = st
      this.listOpt.waveforms = []
      for (let tr of st.trace) {
        this.listOpt.waveforms.push({
          start: tr.timeseries[0].starttime,
          step: 1000 / tr.sample_rate,
          values: tr.getData(),
          id: tr.id,
          distance: this.ttt[tr.id].distance,
          ttt: Object.assign({ O: this.origin.time.value.getTime() }, this.ttt[tr.id].ttt),
          picks: this.picks[tr.id]
        })
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
