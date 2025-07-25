import { shortcutString, getId, deepCopy, getLocalStorageDefault, setLocalStorage } from '@/utils'
import type { ActivityData, ChatData, PickMap, WPNotificationOptions, Config } from '@/types'
import type { QEvent } from '@/lib/sismojs/src/core/event/types'
import WebSocketManager from '@/utils/webSocketManager'
import defaultSettings from '@/utils/defaultSettings'
import { computed, ref, shallowRef } from 'vue'
import EventManager from '@/utils/eventManager'
import DataManager from '@/utils/dataManager'
import { defineStore } from 'pinia'

if (getLocalStorageDefault('version', null) !== 2) {
  localStorage.clear()
  setLocalStorage('version', 2)
}

const author = ref(getLocalStorageDefault('author', null) as string | null)

const notification = ref([] as WPNotificationOptions[])

// Utilities for keybind actions
const keydownDisabled = ref(false)
const keydownEvent = ref(null as KeyboardEvent | null)
const keydown = computed(() => keydownEvent.value != null ? shortcutString(keydownEvent.value) : '')
function preventDefault() {
  if (keydownEvent.value != null) {
    keydownEvent.value.preventDefault()
  }
}

const baseUrl = computed(() => window.location.pathname.includes('event') ? '..' : '.')

// Class handling inventory and waveforms data management
const dataManager = new DataManager()
const events = ref([] as QEvent[])
const eventManager = new EventManager(
  dataManager,
  newEvents => events.value = newEvents
)
const additionalPickMap = shallowRef({} as PickMap)

// Load application settings
const settings = Object.assign(deepCopy(defaultSettings), getLocalStorageDefault('settings', {}))

const authorId = getId('author')
const newVersion = ref(false)
const usersActivity = ref([] as ActivityData[])
const connected = ref(false)
const chatMessages = ref([] as ChatData[])
const webSocketManager = new WebSocketManager(
  author.value || 'unknown user',
  authorId,
  value => newVersion.value = value,
  value => usersActivity.value = value,
  value => connected.value = value,
  value => chatMessages.value.push(value),
  eventid => eventManager.updateEvent(baseUrl.value, eventid)
)

const config = ref(null as Config | null)
fetch(`${baseUrl.value}/app/config`).then(response => {
  if (response.status === 200) {
    response.json().then(data => {
      config.value = data
      if (config.value != null) {
        eventManager.agencyID = config.value.agency
        document.title = config.value.title
      }
    })
  }
})

export const useAppStore = defineStore('app', () => {
  return {
    authorId,
    chatMessages,
    newVersion,
    connected,
    config,
    author,
    notification,
    additionalPickMap,
    keydownDisabled,
    keydownEvent,
    keydown,
    preventDefault,
    events,
    dataManager,
    eventManager,
    webSocketManager,
    usersActivity,
    settings
  }
})
