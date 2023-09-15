<template>
  <v-app :dark="$store.state.settings.themeDark">

    <v-app-bar app dense :style="{ zIndex: 1000 }">
      <img src="../public/static/webpicker_icon.png" height="34" class="mx-2">
      <v-app-bar-title>
        <span>WebPicker</span>
      </v-app-bar-title>
      <v-spacer></v-spacer>
      <v-btn text :to="{ name: 'Form' }">Form</v-btn>
      <v-btn text :to="{ name: 'List', query: listQuery }">Event list</v-btn>
      <v-btn
        v-if="$store.state.currentEvent != null"
        :to="{ name: 'Event', params: { code: $store.state.currentEvent.public_id } }"
        text>Event: {{ $store.state.currentEvent.public_id }}</v-btn>
      <v-btn v-else disabled text>No event</v-btn>
      <v-btn
        :disabled="$store.state.currentOrigin == null"
        :to="{ name: 'Picker' }"
        text>Picker</v-btn>
      <v-menu v-model="toolbarMenu" offset-y>
        <template v-slot:activator="{ on }">
          <v-btn icon v-on="on"><v-icon>mdi-dots-vertical</v-icon></v-btn>
        </template>
        <v-list min-width="300">
          <v-list-item @click="handleCreateEventClick" v-if="$route.name !== 'Picker'">
            <v-icon left>mdi-creation</v-icon> Create new event
          </v-list-item>
          <v-list-item v-if="$store.state.author != null" @click="handleChangeAuthorClick">
            <v-icon left>mdi-account-switch</v-icon> Change author
            <span class="caption ml-2 text-lighten-1">({{ $store.state.author }})</span>
          </v-list-item>
          <v-list-item :to="{ name: 'Settings' }">
            <v-icon left>mdi-cog</v-icon> Settings
          </v-list-item>
          <v-list-item @click="logDialog = true">
            <v-icon left>mdi-console</v-icon> Logs
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-main>
      <v-container fluid>

        <router-view/>

        <v-dialog
          v-model="$store.state.authorDialog"
          persistent
          max-width="400px">
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
          v-model="newEventDialog"
          persistent
          max-width="400px">
          <v-card>
            <v-card-title>
              <span class="headline">Create new event</span>
            </v-card-title>
            <v-card-text>
              <v-text-field
                label="Time [YYYY-mm-dd HH:MM:SS]"
                v-model="newEventTime"
                mask="####-##-## ##:##:##"
                return-masked-value></v-text-field>
              <number-field label="Latitude [°]" v-model="newEventLatitude"></number-field>
              <number-field label="Longitude [°]" v-model="newEventLongitude"></number-field>
              <number-field label="Depth [km]" v-model="newEventDepth"></number-field>
            </v-card-text>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn @click="newEventDialog = false">Cancel</v-btn>
              <v-btn
                @click="handleCreateEventFormSubmit"
                :disabled="!isNewEventFormValid"
                color="primary">Validate</v-btn>
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

        <v-dialog
          v-model="$store.state.alertEventLockedDialog"
          persistent
          width="500">
          <v-card color="warning" light>
            <v-card-title>
              <h3>Someone might be processing this event</h3>
            </v-card-title>
            <v-card-text v-if="$store.state.alertEventLocked != null">
              <div v-for="(msg, index) in $store.state.alertEventLocked" :key="index">
                {{ msg }}
              </div>
            </v-card-text>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn small @click="$store.state.alertEventLockedDialog = false">OK</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-speed-dial v-model="onlineUsers" fixed bottom right transition="slide-y-reverse-transition" class="mb-9">
          <template v-slot:activator>
            <v-btn v-model="onlineUsers" small fab color="blue" light>
              <v-icon v-if="onlineUsers">mdi-close</v-icon>
              <v-icon v-else>mdi-account</v-icon>
            </v-btn>
          </template>
          <div
            class="app__author-status elevation-2"
            :class="{ 'app__author-status--warning': $store.getters.getCurrentEventId == status.eventid }"
            v-for="(status, index) in connectedUsers"
            :key="index">
            <div v-if="status.action == 'browsing'">
              The user <span class="font-weight-bold">{{ status.author }}</span> is online
            </div>
            <div v-else>
              The user <span class="font-weight-bold">{{ status.author }}</span> is {{ status.action }} the event <span class="font-weight-bold">{{ status.eventid }}</span>
            </div>
          </div>
        </v-speed-dial>

        <div class="notification-container">
          <v-alert
            v-for="(notification, index) in $store.state.notificationList"
            :value="notification.value"
            :type="notification.color"
            :key="index"
            transition="scale-transition">
            <div class="notification-container__content-wrapper">
              {{ notification.text }}
            </div>
          </v-alert>
        </div>

        <v-dialog
          scrollable
          v-model="logDialog"
          max-width="900px">
          <v-card>
            <v-card-title>
              <span class="headline">Logs</span>
            </v-card-title>
            <v-card-text style="height: 500px;font-size:11px;">
              <pre>{{ $store.state.log.join('\n') }}</pre>
            </v-card-text>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn @click="logDialog = false">Close</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

      </v-container>
    </v-main>
  </v-app>
</template>

<script>
import * as utils from '@/utils/utils'

export default {

  name: 'app',

  data () {
    return {
      onlineUsers: false,
      toolbarMenu: false,
      author: this.$store.state.author,
      remember: false,
      newEventDialog: false,
      newEventTimeMenu: false,
      newEventTime: null,
      newEventLatitude: null,
      newEventLongitude: null,
      newEventDepth: null,
      logDialog: false
    }
  },

  computed: {

    listQuery () {
      const query = {}
      for (const [k, v] of Object.entries(this.$store.state.form)) {
        if (v != null) {
          query[k] = v
        }
      }
      return query
    },

    isNewEventFormValid () {
      let valid = true
      if (this.newEventTime == null) {
        valid = false
      }
      if (this.newEventLatitude == null || this.newEventLatitude < -90 || this.newEventLatitude > 90) {
        valid = false
      }
      if (this.newEventLongitude == null || this.newEventLongitude < -180 || this.newEventLongitude > 180) {
        valid = false
      }
      if (this.newEventDepth == null || this.newEventDepth < 0 || this.newEventDepth > 6400) {
        valid = false
      }
      return valid
    },

    connectedUsers () {
      return Object.values(this.$store.state.authorStatus).filter(x => x.author !== this.$store.state.author)
    }

  },

  watch: {
    '$store.state.settings.themeDark': function (value) {
      this.$vuetify.theme.dark = value
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
    },

    handleCreateEventClick () {
      const o = this.$store.state.currentOrigin
      if (o) {
        this.newEventTime = o.time._pretty
        this.newEventLatitude = o.latitude.value
        this.newEventLongitude = o.longitude.value
        this.newEventDepth = o.depth.value / 1e3
      }
      this.newEventDialog = true
    },

    handleCreateEventFormSubmit () {
      const eventId = this.$store.getters.getId('Event')
      const originId = this.$store.getters.getId('Origin')
      const creationInfo = {
        agency_id: this.$store.state.agencyId,
        creation_time: new Date().toISOString(),
        author: this.$store.state.author
      }
      const e = {
        origin: [{
          _not_committed: true,
          _is_dirty: true,
          public_id: originId,
          creation_info: creationInfo,
          time: { value: this.newEventTime.replace(' ', 'T') + 'Z' },
          latitude: { value: this.newEventLatitude },
          longitude: { value: this.newEventLongitude },
          depth: { value: this.newEventDepth * 1e3 },
          quality: {
            used_phase_count: 0,
            used_station_count: 0,
            associated_phase_count: 0,
            associated_station_count: 0,
            minimum_distance: 0,
            maximum_distance: 0,
            median_distance: 0,
            azimuthal_gap: 0,
            standard_error: 0
          },
          arrival: []
        }],
        pick: [],
        description: [{ type: 'region name', text: '' }],
        creation_info: creationInfo,
        public_id: eventId,
        preferred_origin_id: originId
      }
      utils.processEventData(e)
      console.log('[App::handleCreateEventFormSubmit] create event', e)
      this.$store.dispatch('setCurrentEvent', e)
      this.$router.push({ name: 'Event', params: { code: eventId } })
      this.newEventDialog = false
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

.notification-container {
  position: fixed;
  z-index: 1000;
  bottom: 80px;
  right: 20px;
  width: 300px;
}
.notification-container__content-wrapper {
  max-height: 200px;
  overflow-y: auto;
}

.app__author-status {
  width: 250px;
  padding: 10px;
  margin: 0px 200px 10px 10px;
  background-color: #bde1f0;
  border-radius: 4px;
  color: rgba(0, 0, 0, 0.8);
}
.app__author-status--warning {
  background-color: #ffc961;
}
</style>
