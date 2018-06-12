<template>
  <el-container style="height: 100vh;">
    <el-header>
      <el-menu :default-active="activeIndex" mode="horizontal" @select="(x, y) => activeIndex = x">
        <el-menu-item index="eventForm">Form</el-menu-item>
        <el-menu-item index="eventList">Event list</el-menu-item>
        <el-menu-item index="eventPage" :disabled="currentEvent == null">
          <span v-if="currentEvent != null">{{ currentEvent._id }}</span>
          <span v-else>No event</span>
        </el-menu-item>
        <el-menu-item index="eventPicker" :disabled="currentOrigin == null">Picker</el-menu-item>
      </el-menu>
    </el-header>
    <el-main v-loading="loading" :element-loading-text="loadingText">
      <keep-alive>
        <event-form
          @submit-event-form="handleSubmitEventForm"
          v-if="activeIndex == 'eventForm'"></event-form>
        <event-list
          :event-list="eventList"
          @select-event="handleSelectEvent"
          v-else-if="activeIndex == 'eventList'"></event-list>
        <event-page
          :event="currentEvent"
          :origin="currentOrigin"
          :inventory="inventory"
          v-else-if="activeIndex == 'eventPage'"></event-page>
        <event-picker
          :event="currentEvent"
          :origin="currentOrigin"
          :inventory="inventory"
          @picker-arrival="handlePickerArrival"
          v-else-if="activeIndex == 'eventPicker'"></event-picker>
      </keep-alive>
    </el-main>
  </el-container>
</template>

<script>
import utils from './utils/utils.js'

export default {
  name: 'app',
  data () {
    return {
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
    this.queryOpt.end = new Date()
    this.queryOpt.start = new Date(this.queryOpt.end.getTime() - 86400000 * 7)
    this.loadInventory(() => {
      // this.loadEventList()
    })
  },
  methods: {
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
        let events = utils.xmlNodeToJson(
          qml.getElementsByTagName('eventParameters')[0],
          '',
          utils.CONVERSION_RULES
        ).event
        for (let e of events) {
          utils.processEventData(e)
        }
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
      let origin = Object.assign({}, this.currentOrigin)
      let id = [
        'Origin',
        new Date().toISOString().replace(/[\-:]/g, '').replace('T', '.').substr(0, 18)
      ].join('-')
      origin._not_committed = true
      origin.public_id = `smi:oca/${id}`
      origin.arrival = arrivals
      this.currentEvent._origin = origin
      this.currentOrigin = origin
    },

    handleSelectEvent (eventId) {
      let oldEvent = this.eventList.find(x => x._id == eventId)
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
        let e = utils.xmlNodeToJson(
          qml.getElementsByTagName('eventParameters')[0],
          '',
          utils.CONVERSION_RULES
        ).event[0]
        utils.processEventData(e)
        this.eventList.splice(index, 1, e)
        e._origin = oldEvent._origin
        this.currentEvent = e
        this.currentOrigin = e._origin != null ? e._origin : e._po
        this.activeIndex = 'eventPage'
      })
    },
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
</style>
