<template>
  <el-container style="height: 100vh;">
    <el-header>
      <el-menu :default-active="activeIndex" mode="horizontal" @select="(x, y) => activeIndex = x">
        <el-menu-item index="eventList">Event list</el-menu-item>
        <el-menu-item index="eventPage" :disabled="currentEvent == null">
          <span v-if="currentEvent != null">{{ currentEvent.$publicID }}</span>
          <span v-else>No event</span>
        </el-menu-item>
        <el-menu-item index="eventPicker" :disabled="currentOrigin == null">Picker</el-menu-item>
      </el-menu>
    </el-header>
    <el-main>
      <keep-alive>
        <event-list
          v-loading="loading"
          :element-loading-text="loadingText"
          :event-list="eventList"
          @select-event="handleSelectEvent"
          v-if="activeIndex == 'eventList'"></event-list>
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

const conversionRules = {
  // keep list for all these nodes :
  '/eventParameters/event': true,
  '/eventParameters/event/origin': true,
  '/eventParameters/event/origin/arrival': true,
  '/eventParameters/event/magnitude': true,
  '/eventParameters/event/pick': true,
  // conversion function :
  '/eventParameters/event/$publicID': x => x.split('/').slice(-1)[0],
  '/eventParameters/event/origin/latitude/value': parseFloat,
  '/eventParameters/event/origin/latitude/uncertainty': parseFloat,
  '/eventParameters/event/origin/longitude/value': parseFloat,
  '/eventParameters/event/origin/longitude/uncertainty': parseFloat,
  '/eventParameters/event/origin/depth/value': parseFloat,
  '/eventParameters/event/origin/depth/uncertainty': parseFloat,
  '/eventParameters/event/origin/time/value': x => new Date(Date.parse(x)),
  '/eventParameters/event/origin/time/uncertainty': parseFloat,
  '/eventParameters/event/origin/quality/standardError': parseFloat,
  '/eventParameters/event/origin/quality/minimumDistance': parseFloat,
  '/eventParameters/event/origin/quality/azimuthalGap': parseFloat,
  '/eventParameters/event/origin/quality/usedPhaseCount': parseInt,
  '/eventParameters/event/origin/arrival/pickID': x => x.split('/').slice(-1)[0],
  '/eventParameters/event/origin/arrival/timeResidual': parseFloat,
  '/eventParameters/event/origin/arrival/timeWeight': parseFloat,
  '/eventParameters/event/origin/arrival/distance': parseFloat,
  '/eventParameters/event/origin/arrival/azimuth': parseFloat,
  '/eventParameters/event/magnitude/mag/value': parseFloat,
  '/eventParameters/event/pick/$publicID': x => x.split('/').slice(-1)[0],
  '/eventParameters/event/pick/time/value': x => new Date(Date.parse(x))
}

export default {
  name: 'app',
  data () {
    return {
      loading: true,
      loadingText: '',
      activeIndex: 'eventList',
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
    this.loadInventoryThenEventList()
    // this.loadEventList()
  },
  methods: {
    loadInventoryThenEventList () {
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
        this.loadEventList()
      })
    },
    loadEventList () {
      this.loadingText = 'Loading events...'
      utils.ajax({
        method: 'GET',
        url: 'fdsnws/event/1/query',
        args: {
          starttime: this.queryOpt.start.toISOString().substr(0, 19),
          endtime: this.queryOpt.end.toISOString().substr(0, 19),
          format: 'xml'
        },
        type: 'document'
      }).then(qml => {
        let events = utils.xmlNodeToJson(
          qml.getElementsByTagName('eventParameters')[0],
          '',
          conversionRules
        ).event
        for (let e of events) {
          utils.processEventData(e)
        }
        this.eventList = events
        this.loading = false
      })
    },
    handlePickerArrival (arrivals) {
      let clone = Object.assign({}, this.currentOrigin)
      let id = [
        'Origin',
        new Date().toISOString().replace(/[\-:]/g, '').replace('T', '.').substr(0, 18)
      ].join('-')
      clone.$publicID = id
      clone.arrival = arrivals
      this.currentEvent.origin.push(clone)
      this.currentOrigin = clone
    },
    handleSelectEvent (eventId) {
      let oldEvent = this.eventList.find(x => x.$publicID == eventId)
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
          conversionRules
        ).event[0]
        utils.processEventData(e)
        this.eventList.splice(index, 1, e)
        this.currentEvent = e
        this.currentOrigin = e.po
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
</style>
