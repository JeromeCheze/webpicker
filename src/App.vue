<script setup lang="ts">
import { getLocalStorageDefault, setLocalStorage } from './utils'
import { ref, onMounted, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { RouterView } from 'vue-router'

const store = useAppStore()
const authorDialog = ref(store.author == null)
const authorValue = ref(store.author || '')
const settingsDialog = ref(false)
const createEventDialog = ref(false)
const chatMenu = ref(false)
const drawer = ref(true)
const rail = ref(getLocalStorageDefault('navDrawer', false) as boolean)
const logDialog = ref(false)
const connectionPopup = ref(false)
const connectionStatus = ref('error' as 'success' | 'error' | 'info')
const infoNotification = ref(false)
const infoNotificationText = ref('')
const persistentNotification = ref(false)
const persistentNotificationText = ref('')
const persistentNotificationType = ref('warning')
const progressNotification = ref(false)
const progressNotificationValue = ref({ percent: 0, text: '' })


function handleSetAuthor(e: SubmitEvent) {
  e.preventDefault()
  setLocalStorage('author', authorValue.value)
  store.author = authorValue.value
  store.webSocketManager.author = store.author
  authorDialog.value = false
}

function setBackground() {
  const appDiv = document.body.querySelector('.v-application') as HTMLElement | null
  if (appDiv != null) {
    appDiv.style.background = store.settings['color.background']
  }
}

function checkAuthor(value: string) {
  return value !== '' && value[0] !== '@' || 'Invalid value.'
}

function reload() {
  location.reload()
}

watch([
  () => store.connected,
  () => store.newVersion
], () => {
  if (store.connected) {
    if (store.newVersion) {
      connectionStatus.value = 'info'
    } else {
      connectionStatus.value = 'success'
    }
  } else {
    connectionStatus.value = 'error'
  }
  connectionPopup.value = true
})

watch(rail, (value) => {
  setLocalStorage('navDrawer', value)
})

watch(() => store.settings['color.background'], () => {
  setBackground()
})

watch(() => store.notification, (value) => {
  const curr = value.shift()
  if (curr != null) {
    if (curr.type === 'info') {
      if (curr.value == null) {
        infoNotification.value = false
      } else {
        infoNotificationText.value = curr.value
        infoNotification.value = true
      }
    } else if (curr.type === 'warning') {
      persistentNotificationType.value = 'warning'
      if (curr.value == null) {
        persistentNotification.value = false
      } else {
        persistentNotificationText.value = curr.value
        persistentNotification.value = true
      }
    } else if (curr.type === 'error') {
      persistentNotificationType.value = 'error'
      if (curr.value == null) {
        persistentNotification.value = false
      } else {
        persistentNotificationText.value = curr.value
        persistentNotification.value = true
      }
    } else if (curr.type === 'progress') {
      if (curr.value == null) {
        progressNotification.value = false
      } else {
        progressNotificationValue.value = curr.value
        progressNotification.value = true
      }
    }
  }
}, { deep: true })

onMounted(() => {
  setBackground()
  document.body.addEventListener('keydown', ev => {
    if (!settingsDialog.value && !authorDialog.value && !chatMenu.value) {
      store.keydownEvent = ev
    }
  })
  document.body.addEventListener('keyup', ev => {
    store.keydownEvent = null
  })
  document.body.addEventListener('wheel', ev => {
    if (ev.ctrlKey) {
      ev.preventDefault()
    }
  }, { passive: false })
})
</script>

<template>
  <v-app :theme="store.settings['color.theme']" :class="{ custom: store.settings['color.surface'] != null && store.settings['color.surface'] !== '' }">
    <v-main>
      <v-container fluid>
        <RouterView />
      </v-container>
      <v-snackbar
        v-model="connectionPopup"
        :color="connectionStatus"
        :timeout="connectionStatus === 'success' ? 2000 : -1"
      >
        <div v-if="connectionStatus === 'success'"><v-icon>mdi-check</v-icon> Connected.<br><v-icon>mdi-check</v-icon> Version is up to date.</div>
        <div class="text-center" v-else-if="connectionStatus === 'info'"><v-icon>mdi-alert-circle-outline</v-icon> New version available.<br><v-btn light prepend-icon="mdi-cloud-sync" @click="reload">click to update</v-btn></div>
        <div class="text-center" v-else><v-icon>mdi-cloud-off-outline</v-icon> Disconnected from server...</div>
      </v-snackbar>
      <v-snackbar v-model="infoNotification" timeout="2000">{{ infoNotificationText }}</v-snackbar>
      <v-snackbar v-model="progressNotification" timeout="-1">
        <v-progress-circular :model-value="progressNotificationValue.percent" :indeterminate="progressNotificationValue.percent === -1" size="16" class="mr-2"/>
        {{ progressNotificationValue.text }}
      </v-snackbar>
      <v-snackbar v-model="persistentNotification" timeout="-1" vertical :color="persistentNotificationType">
        <pre :style="{ maxHeight: '200px', overflowY: 'auto' }">{{ persistentNotificationText }}</pre>
        <template v-slot:actions>
          <v-btn variant="text" @click="persistentNotification = false">Close</v-btn>
        </template>
      </v-snackbar>
    </v-main>
    <v-navigation-drawer v-model="drawer" :rail="rail" permanent>
      <v-list nav>
        <v-list-item prepend-avatar="@/assets/wp.png" class="font-weight-bold" @click.stop="rail = !rail">
          WebPicker
          <template v-slot:append>
            <v-btn variant="text" icon="mdi-chevron-left" @click.stop="rail = !rail"></v-btn>
          </template>
        </v-list-item>
        <v-list-item
          :to="{ name: 'query' }"
          title="Query"
          prepend-icon="mdi-database"></v-list-item>
        <v-list-item
          :to="{ name: 'event', params: { eventid: store.currentEvent.publicID } }"
          :title="store.currentEvent.publicID"
          prepend-icon="mdi-bullseye"
          v-if="store.currentEvent != null"></v-list-item>
        <v-list-item
          title="Create event"
          prepend-icon="mdi-plus-circle-outline"
          @click="createEventDialog = !createEventDialog"
          :active="createEventDialog"></v-list-item>
        <v-list-item
          :to="{ name: 'plot' }"
          title="Plot"
          prepend-icon="mdi-eye"></v-list-item>
        <v-list-item
          title="Settings"
          prepend-icon="mdi-cog"
          @click="settingsDialog = !settingsDialog"
          :active="settingsDialog"></v-list-item>
        <!-- <v-list-item title="Logs" prepend-icon="mdi-console"></v-list-item> -->
        <v-list-item :title="store.author || 'undefined'" prepend-icon="mdi-account" @click="authorDialog = true"></v-list-item>
        <ChatPanel v-model="chatMenu"/>
      </v-list>
    </v-navigation-drawer>
    <v-dialog v-model="authorDialog" persistent width="500" attach>
      <v-form @submit="handleSetAuthor">
        <v-card>
          <v-card-title>
            <div class="text-h5 text-medium-emphasis ps-2">Set author</div>
          </v-card-title>
          <v-card-text>
            <v-text-field label="Author" required v-model="authorValue" :rules="[checkAuthor]"></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="primary" type="submit" :disabled="authorValue == ''">OK</v-btn>
          </v-card-actions>
        </v-card>
      </v-form>
    </v-dialog>
    <SettingsPanel v-model="settingsDialog"/>
    <CreateEvent v-model="createEventDialog"/>
  </v-app>
</template>

<style>
.custom .v-theme--dark,
.custom .v-theme--light {
  --v-theme-surface: v-bind('store.settings["color.surface"]');
}

.circle {
  width: 10px;
  height: 10px;
  background: white;
  border: 1px solid black;
  border-radius: 6px;
}

.c-move {
  cursor: move;
}

.c-ns-resize {
  cursor: ns-resize;
}
</style>