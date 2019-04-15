<template>
  <v-app>
    <v-toolbar app dense :style="{ zIndex: 1000 }">
      <v-toolbar-title>WebPicker</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-toolbar-items>
        <v-btn flat :to="{ name: 'Form' }">Form</v-btn>
        <v-btn flat :to="{ name: 'List', query: listQuery }">Event list</v-btn>
        <v-btn
          v-if="$store.state.currentEvent != null"
          :to="{ name: 'Event', params: { code: $store.state.currentEvent.public_id } }"
          flat>Event: {{ $store.state.currentEvent.public_id }}</v-btn>
        <v-btn v-else disabled flat>No event</v-btn>
        <v-btn
          :disabled="$store.state.currentOrigin == null"
          :to="{ name: 'Picker' }"
          flat>Picker</v-btn>
        <v-btn flat :to="{ name: 'Settings' }" icon>
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
        <v-snackbar
          v-for="notification in $store.state.notificationList"
          v-model="notification.value"
          :color="notification.color"
          bottom right
        >{{ notification.text }}</v-snackbar>
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

  computed: {
    listQuery () {
      let query = {}
      for (let [k, v] of Object.entries(this.$store.state.form)) {
        if (v != null) {
          query[k] = v
        }
      }
      return query
    }
  },

  mounted () {
    this.$store.dispatch('initialize')
  }

}
</script>

<style>
/*body {
  margin: 0;
  padding: 0;
  font-family: "Helvetica Neue",Helvetica,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","微软雅黑",Arial,sans-serif;
}*/
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
