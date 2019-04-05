<template>
  <v-app>
    <v-toolbar app dense :style="{ zIndex: 1000 }">
      <v-toolbar-title>WebPicker</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-toolbar-items>
        <v-btn flat to="/form">Form</v-btn>
        <v-btn flat to="/list">Event list</v-btn>
        <v-btn
          v-if="$store.state.currentEvent != null"
          :to="`/event/${$store.state.currentEvent.public_id}`"
          flat>Event: {{ $store.state.currentEvent.public_id }}</v-btn>
        <v-btn v-else disabled flat>No event</v-btn>
        <v-btn
          :disabled="$store.state.currentOrigin == null"
          to="/picker"
          flat>Picker</v-btn>
        <v-btn flat to="/settings" icon>
          <v-icon>mdi-settings-outline</v-icon>
        </v-btn>
      </v-toolbar-items>
    </v-toolbar>
    <v-content>
      <v-container fluid>
        <router-view></router-view>
        <v-dialog
          v-model="$store.state.loading"
          hide-overlay
          persistent
          width="300"
        >
          <v-card color="primary" dark>
            <v-card-text>
              {{ $store.state.loadingMsg }}
              <v-progress-linear indeterminate color="white" class="mb-0"></v-progress-linear>
            </v-card-text>
          </v-card>
        </v-dialog>
      </v-container>
    </v-content>
  </v-app>
</template>

<script>
import utils from './utils/utils.js'
import settings from './settings.json'

const STORAGE_KEY = 'settings'

export default {
  name: 'app',
  data () {
    return {}
  },
  mounted () {
    this.$store.dispatch('initialize')
  },
  methods: {
    // storeSettings () {
    //   let toStore = {}
    //   for (let [k, v] of Object.entries(this.settings)) {
    //     if (v.value != v.default) {
    //       toStore[k] = v.value
    //     }
    //   }
    //   localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
    //   this.$notify.success({ message: 'Settings successfully saved' })
    // },
    //
    // loadSettings () {
    //   let storedSettings = localStorage.getItem(STORAGE_KEY)
    //   storedSettings = storedSettings != null ? JSON.parse(storedSettings) : {}
    //   for (let [key, defaultValue] of Object.entries(settings)) {
    //     let storedValue = storedSettings[key]
    //     this.$set(this.settings, key, {
    //       default: defaultValue,
    //       value: storedValue != null ? storedValue : defaultValue
    //     })
    //   }
    // },

    // loadInventory (callback) {
    //   this.loadingText = 'Loading inventory...'
    //   utils.ajax({
    //     method: 'GET',
    //     url: 'fdsnws/station/1/query',
    //     args: {
    //       starttime: this.queryOpt.start.toISOString().substr(0, 19),
    //       endtime: this.queryOpt.end.toISOString().substr(0, 19),
    //       level: 'channel',
    //       format: 'text'
    //     },
    //     type: 'text'
    //   }).then(raw_inv => {
    //     this.inventory = utils.parseInventory(raw_inv)
    //     this.loading = false
    //     if (callback != null) {
    //       callback.call()
    //     }
    //   })
    // },

    /* TODO: move to EventView */
    // handlePickerArrival (arrivals) {
    //   let o = Object.assign({}, this.currentOrigin)
    //   o._not_committed = true
    //   o._is_dirty = true
    //   o.public_id = utils.getId('Origin')
    //   o.arrival = arrivals
    //   this.currentEvent.preferred_magnitude_id = null
    //   this.currentEvent.origin.push(o)
    //   this.currentOrigin = o
    //   // update event picks (keep only used pick)
    //   let picks = []
    //   let all_arrivals = [].concat(arrivals)
    //   for (let o of this.currentEvent.origin) {
    //     all_arrivals = all_arrivals.concat(o.arrival)
    //   }
    //   for (let a of all_arrivals) {
    //     if (picks.indexOf(a._pick) < 0) {
    //       picks.push(a._pick)
    //     }
    //   }
    //   this.currentEvent.pick = picks
    // },
    //
    // handleSetCurrentOrigin (o) {
    //   this.currentOrigin = o
    //   this.$refs.eventPage.$nextTick(function() {
    //     this.updateAll(o)
    //   })
    // }
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
