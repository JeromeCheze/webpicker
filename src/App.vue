<template>
  <el-container style="height: 100vh;">
    <el-header>
      <el-menu :default-active="activeIndex" mode="horizontal" @select="(x, y) => activeIndex = x">
        <li class="menu-title">WebPicker</li>
        <el-menu-item index="eventForm">Form</el-menu-item>
        <el-menu-item index="eventList">Event list</el-menu-item>
        <el-menu-item index="eventPage" :disabled="currentEvent == null">
          <span v-if="currentEvent != null">Event: {{ currentEvent.public_id }}</span>
          <span v-else>No event</span>
        </el-menu-item>
        <el-menu-item index="eventPicker" :disabled="currentOrigin == null">Picker</el-menu-item>
        <el-menu-item index="userSettings" class="pull-right"><i class="el-icon-setting"></i></el-menu-item>
      </el-menu>
    </el-header>
    <el-main v-loading.fullscreen.lock="loading" :element-loading-text="loadingText">
      <keep-alive>
        <event-form
          @submit-event-form="handleSubmitEventForm"
          v-if="activeIndex == 'eventForm'"></event-form>
        <event-list
          :event-list="eventList"
          @select-event="handleSelectEvent"
          v-else-if="activeIndex == 'eventList'"></event-list>
        <event-page
          ref="eventPage"
          :event="currentEvent"
          :origin="currentOrigin"
          :inventory="inventory"
          @relocate="handleRelocate"
          @compute-magnitudes="handleComputeMagnitudes"
          @commit="handleCommit"
          @set-current-origin="handleSetCurrentOrigin"
          v-else-if="activeIndex == 'eventPage'"></event-page>
        <event-picker
          ref="eventPicker"
          :event="currentEvent"
          :origin="currentOrigin"
          :inventory="inventory"
          :settings="settings"
          @picker-arrival="handlePickerArrival"
          v-else-if="activeIndex == 'eventPicker'"></event-picker>
        <user-settings
          v-model="settings"
          @settings-updated="storeSettings"
          v-else-if="activeIndex == 'userSettings'"></user-settings>
      </keep-alive>
    </el-main>
  </el-container>
</template>

<script>
import utils from './utils/utils.js'
import settings from './settings.json'

const STORAGE_KEY = 'settings'

export default {
  name: 'app',
  data () {
    return {
      settings: {},
      loading: true,
      loadingText: '',
      activeIndex: 'eventForm',
      inventory: null,
      eventList: [],
      currentEvent: null,
      currentOrigin: null,
      queryOpt: {
        start: null,
        end: null
      }
    }
  },
  mounted () {
    this.loadSettings()
    this.queryOpt.end = new Date()
    this.queryOpt.start = new Date(this.queryOpt.end.getTime() - 86400000 * 7)
    this.loadInventory(() => {
      // this.loadEventList()
    })
  },
  methods: {
    storeSettings () {
      let toStore = {}
      for (let [k, v] of Object.entries(this.settings)) {
        if (v.value != v.default) {
          toStore[k] = v.value
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
      this.$notify.success({ message: 'Settings successfully saved' })
    },

    loadSettings () {
      let storedSettings = localStorage.getItem(STORAGE_KEY)
      storedSettings = storedSettings != null ? JSON.parse(storedSettings) : {}
      for (let [key, defaultValue] of Object.entries(settings)) {
        let storedValue = storedSettings[key]
        this.$set(this.settings, key, {
          default: defaultValue,
          value: storedValue != null ? storedValue : defaultValue
        })
      }
    },

    loadInventory (callback) {
      this.loadingText = 'Loading inventory...'
      utils.ajax({
        method: 'GET',
        url: 'fdsnws/station/1/query',
        args: {
          starttime: this.queryOpt.start.toISOString().substr(0, 19),
          endtime: this.queryOpt.end.toISOString().substr(0, 19),
          level: 'channel',
          format: 'text'
        },
        type: 'text'
      }).then(raw_inv => {
        this.inventory = utils.parseInventory(raw_inv)
        this.loading = false
        if (callback != null) {
          callback.call()
        }
      })
    },

    loadEventList (args) {
      this.activeIndex = 'eventList'
      this.loading = true
      this.loadingText = 'Loading events...'
      utils.ajax({
        method: 'GET',
        url: 'fdsnws/event/1/query',
        args: args,
        type: 'document'
      }).then(qml => {
        let events = utils.parseQuakeML(qml)
        this.eventList = events
        this.loading = false
      })
    },

    handleSubmitEventForm (form) {
      let args = { format: 'xml' }
      for (let [k, v] of Object.entries(form)) {
        if (v != null) {
          args[k] = v
        }
      }
      this.loadEventList(args)
    },

    handlePickerArrival (arrivals) {
      let o = Object.assign({}, this.currentOrigin)
      o._not_committed = true
      o._is_dirty = true
      o.public_id = utils.getId('Origin')
      o.arrival = arrivals
      this.currentEvent.preferred_magnitude_id = null
      this.currentEvent.origin.push(o)
      this.currentOrigin = o
      // update event picks (keep only used pick)
      let picks = []
      let all_arrivals = [].concat(arrivals)
      for (let o of this.currentEvent.origin) {
        all_arrivals = all_arrivals.concat(o.arrival)
      }
      for (let a of all_arrivals) {
        if (picks.indexOf(a._pick) < 0) {
          picks.push(a._pick)
        }
      }
      this.currentEvent.pick = picks
    },

    handleSelectEvent (eventId) {
      let oldEvent = this.eventList.find(x => x.public_id == eventId)
      let index = this.eventList.indexOf(oldEvent)
      utils.ajax({
        method: 'GET',
        url: 'fdsnws/event/1/query',
        args: {
          format: 'xml',
          eventid: eventId,
          includeallorigins: 'true',
          includeallmagnitudes: 'true',
          includearrivals: 'true'
        },
        type: 'document'
      }).then(qml => {
        let e = utils.parseQuakeML(qml)[0]
        this.eventList.splice(index, 1, e)
        // e._origin = oldEvent._origin
        let notCommitted = oldEvent.origin.find(o => o._not_committed == true)
        let foundOrigin = notCommitted != null ? e.origin.find(o => o.public_id == notCommitted.public_id) : null
        if (notCommitted != null && foundOrigin == null) {
          e.origin.push(notCommitted)
          this.currentOrigin = notCommitted
        } else {
          this.currentOrigin = e._po
        }
        this.currentEvent = e
        this.activeIndex = 'eventPage'
      })
    },

    handleSetCurrentOrigin (o) {
      this.currentOrigin = o
      this.$refs.eventPage.$nextTick(function() {
        this.updateAll(o)
      })
    },

    handleRelocate () {
      this.loadingText = 'Relocate, please wait...'
      this.loading = true
      // console.log(this.currentOrigin);
      let e = utils.composeEvent({
        base: this.currentEvent, origins: [this.currentOrigin], po: this.currentOrigin
      })
      utils.ajax({
        method: 'POST', url: 'relocate',
        type: 'json', dataMimeType: 'application/json',
        data: JSON.stringify([e]),
      }).then(data => {
        this.loading = false
        if (data.message != '') {
          this.$notify.error({ message: data.message })
        } else {
          let parser = new DOMParser()
          let qml = parser.parseFromString(data.quakeml, 'application/xml')
          // console.log(qml);
          let e = utils.parseQuakeML(qml)[0]
          console.log(e);
          let o = e.origin[0]
          o.evaluation_mode = 'manual'
          o._not_committed = true
          // keep only one not committed origin
          let notCommitted = this.currentEvent.origin.filter(x => x._not_committed)
          for (let origin of notCommitted) {
            this.currentEvent.origin.splice(this.currentEvent.origin.indexOf(origin), 1)
          }
          if (!this.currentOrigin._not_committed) {
            o.public_id = utils.getId('Origin')
          }
          this.currentEvent.origin.push(o)
          this.currentOrigin = o
          this.currentEvent.preferred_magnitude_id = null
          this.currentEvent._pm = null
          this.$refs.eventPage.$nextTick(function() {
            this.updateAll(o)
          })
        }
      })
    },

    handleComputeMagnitudes () {
      this.loadingText = 'Compute magnitudes, please wait...'
      this.loading = true
      let e = utils.composeEvent({
        base: this.currentEvent, origins: [this.currentOrigin], po: this.currentOrigin
      })
      utils.ajax({
        method: 'POST', url: 'compute_magnitudes',
        type: 'json', dataMimeType: 'application/json',
        data: JSON.stringify([e]),
      }).then(data => {
        this.loading = false
        if (data.quakeml == null) {
          this.$notify.error({ message: data.message })
        }
        if (data.quakeml != null) {
          let parser = new DOMParser()
          let qml = parser.parseFromString(data.quakeml, 'application/xml')
          // console.log(qml);
          let e = utils.parseQuakeML(qml)[0]
          console.log(e);
          for (let m of e.magnitude) {
            m.origin_id = this.currentOrigin.public_id
            this.currentEvent.magnitude.push(m)
          }
          this.currentEvent.preferred_magnitude_id = e.magnitude[0].public_id
          this.currentEvent._pm = e.magnitude[0]
        }
      })
    },

    handleCommit (commitOpt) {
      this.loadingText = 'Commit in progress...'
      this.loading = true
      this.currentEvent.type = commitOpt.eventType
      this.currentEvent.type_certainty = commitOpt.eventTypeCertainty
      this.currentEvent.preferred_origin_id = this.currentOrigin.public_id
      this.currentOrigin.evaluation_status = commitOpt.originEvaluationStatus
      let e = utils.cloneAndClean(this.currentEvent, '/event_parameters/event')
      // console.log(e);
      utils.ajax({
        method: 'POST',
        url: 'commit',
        type: 'json',
        dataMimeType: 'application/json',
        data: JSON.stringify([e]),
      }).then(data => {
        console.log(data);
        this.loading = false
        if (data.return_code == 0) {
          this.currentOrigin._not_committed = false
          this.handleSelectEvent(this.currentEvent.public_id)
        } else {
          this.$alert(data.message.replace('\n', '<br>'), 'scdispatch debug', {
            dangerouslyUseHTMLString: true
          })
        }
      })
    }
  }
}
</script>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: "Helvetica Neue",Helvetica,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","微软雅黑",Arial,sans-serif;
}
.toolbar {
  padding: 10px;
  background: #f3f3f3;
  border-radius: 4px;
  margin-bottom: 10px;
}
.toolbar .el-form-item {
  margin-bottom: 0;
}

.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

.el-header {
  padding: 0;
}

.el-menu-item.pull-right {
  float: right;
}

.menu-title {
  float: left;
  height: 60px;
  line-height: 60px;
  margin: 0;
  font-size: 14px;
  padding: 0 20px;
  font-weight: bold;
  box-sizing: border-box;
}
</style>
