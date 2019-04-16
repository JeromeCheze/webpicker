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
        <v-menu v-model="toolbarMenu" offset-y>
          <template v-slot:activator="{ on }">
            <v-btn icon v-on="on"><v-icon>mdi-dots-vertical</v-icon></v-btn>
          </template>
          <v-list>
            <v-list-tile v-if="$store.state.author != null" @click="handleChangeAuthorClick">
              <v-icon left>mdi-account-switch</v-icon> Change author
              <span class="caption ml-2 text-lighten-1">({{ $store.state.author }})</span>
            </v-list-tile>
            <v-list-tile :to="{ name: 'Settings' }">
              <v-icon left>mdi-settings</v-icon> Settings
            </v-list-tile>
          </v-list>
        </v-menu>
      </v-toolbar-items>
    </v-toolbar>
    <v-content>
      <v-container fluid>
        <router-view></router-view>
        <v-dialog
          v-model="$store.state.authorDialog"
          persistent
          max-width="600px">
          <v-card>
            <v-card-title>
              <span class="headline">Set author name</span>
            </v-card-title>
            <v-card-text>
              <v-text-field label="Author" v-model="author"></v-text-field>
              <v-checkbox label="Remember" v-model="remember"></v-checkbox>
            </v-card-text>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn
                :disabled="author == null || author == ''"
                color="primary"
                @click="handleAuthorFormSubmit()"
              >Submit</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
        <v-dialog
          v-model="$store.state.loading"
          hide-overlay
          persistent
          width="300">
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
    return {
      toolbarMenu: false,
      author: this.$store.state.author,
      remember: false
    }
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
  },

  methods: {
    handleChangeAuthorClick () {
      this.author = this.$store.state.author
      this.$store.state.authorDialog = true
    },
    handleAuthorFormSubmit () {
      this.$store.dispatch('setAuthor', {
        author: this.author,
        remember: this.remember
      })
    }
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
