<template>
  <el-container>
    <el-header>
      <el-menu :default-active="activeIndex" mode="horizontal" @select="(x, y) => activeIndex = x">
        <el-menu-item index="eventList">Event list</el-menu-item>
        <el-menu-item index="eventPage" :disabled="currentEvent != null">
          <span v-if="currentEvent != null">{{ currentEvent.publicID }}</span>
          <span v-else>No event</span>
        </el-menu-item>
        <el-menu-item index="eventPicker" :disabled="currentEvent != null">Picker</el-menu-item>
      </el-menu>
    </el-header>
    <el-main>
      <event-list
        v-loading="loading"
        :event-list="eventList"
        @select-event="handleSelectEvent"
        v-if="activeIndex == 'eventList'"></event-list>
      <event-page
        :event="currentEvent"
        v-else-if="activeIndex == 'eventPage'"></event-page>
      <event-picker
        :event="currentEvent"
        v-else-if="activeIndex == 'eventPicker'"></event-picker>
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
  '/eventParameters/event/magnitude/mag/value': parseFloat
}

export default {
  name: 'app',
  data () {
    return {
      loading: true,
      activeIndex: 'eventList',
      eventList: [],
      currentEvent: null
    }
  },
  mounted () {
    this.loadEventList()
  },
  methods: {
    processEventData (e) {
      for (let o of e.origin) {
        o.time.pretty = o.time.value.toISOString().replace('T', ' ').substr(0, 19)
        let [lat, lon] = [o.latitude.value, o.longitude.value]
        o.latitude.pretty = lat > 0 ? `${lat.toFixed(2)}° N` : `${(-1*lat).toFixed(2)}° S`
        o.longitude.pretty = lon > 0 ? `${lon.toFixed(2)}° E` : `${(-1*lon).toFixed(2)}° W`
        o.depth.pretty = `${(o.depth.value/1000).toFixed(0)} km`
      }
      for (let m of e.magnitude) {
        m.mag.pretty = m.mag.value.toFixed(2)
      }
      e.po = e.origin.find(x => x.$publicID == e.preferredOriginID)
      if (e.preferredMagnitudeID) {
        e.pm = e.magnitude.find(x => x.$publicID == e.preferredMagnitudeID)
      }

      if (e.pick != null && e.po.arrival != null) {
        let pickMap = {}
        for (let p of e.pick) {
          pickMap[p.$publicID] = p
        }
        for (let a of e.po.arrival) {
          a.pick = pickMap[a.pickID]
        }
      }
    },
    handleSelectEvent (eventId) {
      this.currentEvent = this.loadEvent(eventId)
      this.activeIndex = 'eventPage'
    },
    loadEventList () {
      this.loading = true
      let end = new Date()
      let start = new Date(end.getTime() - 86400000 * 7)
      utils.ajax({
        method: 'GET',
        url: 'fdsnws/event/1/query',
        args: {
          starttime: start.toISOString().substr(0, 19),
          endtime: end.toISOString().substr(0, 19),
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
          this.processEventData(e)
        }
        this.loading = false
        this.eventList = events
      })
    },
    loadEvent (eventId) {

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
