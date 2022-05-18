import { AuthorStatus, LoadingObject, NotificationObject, SetAuthorObject, State, StringIndexedObject, TheoreticalTravelTimeObject, WebpickerEventParameters, WebpickerFocalMechanism, WebpickerForm, WebpickerInventory, WebpickerOrigin, WebpickerSettings } from '@/types'
import * as utils from '@/utils/utils'

export const INIT_FORM = (state: State, data: object) => {
  const cloneForm = Object.assign({}, state.form)
  for (const [k, v] of Object.entries(data)) {
    cloneForm[k] = v
  }
  state.form = cloneForm
}

export const SET_AUTHOR = (state: State, data: SetAuthorObject) => {
  state.author = data.author
  if (data.remember) {
    localStorage.setItem('author', data.author)
  } else {
    localStorage.removeItem('author')
  }
  state.authorDialog = false
  utils.ajax({
    method: 'GET',
    url: `${state.root}set_author`,
    type: 'json',
    args: { author: state.author }
  }).then(data => {
    console.log('[store.mutation::SET_AUTHOR] response', data)
    LOG(state, `[store.mutation::SET_AUTHOR] response: ${JSON.stringify(data)}`)
  }).catch(data => {
    console.log('[store.mutation::SET_AUTHOR] request failed', data)
    LOG(state, `[store.mutation::SET_AUTHOR] request failed: ${data}`)
  })
}

export const ACKNOWLEDGE_MESSAGE = (state: State, data: string) => {
  state.acknowledgedMsgIds.push(data)
}

export const SET_EVENT_LIST_DIRTY = (state: State, data: boolean) => {
  state.eventListDirty = data
}

export const SET_AUTHOR_STATUS = (state: State, data: AuthorStatus) => {
  let dirty = false
  for (const [k, v] of Object.entries(data)) {
    if (state.authorStatus[k] == null) {
      dirty = true
      break
    } else {
      for (const [k2, v2] of Object.entries(v)) {
        if (state.authorStatus[k][k2] !== v2) {
          dirty = true
          break
        }
      }
      if (dirty) {
        break
      }
    }
  }
  if (!dirty) {
    for (const k of Object.keys(state.authorStatus)) {
      if (data[k] == null) {
        dirty = true
        break
      }
    }
  }
  if (dirty) {
    state.authorStatus = data
  }
}

export const SET_AUTHOR_DIALOG = (state: State, data: boolean) => {
  state.authorDialog = data
}

export const SET_EVENT_LIST = (state: State, data: WebpickerEventParameters[]) => {
  state.eventList = data
}

export const SET_CURRENT_EVENT = (state: State, data: WebpickerEventParameters) => {
  const oldEvent = state.eventList.find(x => x.public_id === data.public_id)
  if (oldEvent != null) {
    const index = state.eventList.indexOf(oldEvent)
    state.eventList.splice(index, 1, data)
    const notCommitted = oldEvent.origin.find(o => o._not_committed === true)
    let foundOrigin = null
    foundOrigin = notCommitted != null ? data.origin.find(o => o.public_id === notCommitted.public_id) : null
    if (notCommitted != null && foundOrigin == null) {
      data.origin.push(notCommitted)
      state.currentOrigin = notCommitted
    } else {
      state.currentOrigin = data._po as WebpickerOrigin
    }
    state.currentEvent = data
  } else {
    state.eventList.push(data)
    state.currentOrigin = data._po as WebpickerOrigin
    state.currentEvent = data
  }
  state.currentFocalMechanism = data._pfm
}

export const ALERT_EVENT_LOCKED = (state: State, data: string[]) => {
  state.alertEventLocked = data
  state.alertEventLockedDialog = true
}

export const SET_CURRENT_ORIGIN = (state: State, data: WebpickerOrigin) => {
  state.currentOrigin = data
}

export const SET_CURRENT_FOCAL_MECHANISM = (state: State, data: WebpickerFocalMechanism) => {
  state.currentFocalMechanism = data
}

export const SET_LOADING = (state: State, data: LoadingObject) => {
  state.loading = data.value
  state.loadingMsg = data.text || 'Loading...'
}

export const ADD_NOTIFICATION = (state: State, data: NotificationObject) => {
  const outdated = state.notificationList.filter(x => !x.value)
  for (const notification of outdated) {
    state.notificationList.splice(state.notificationList.indexOf(notification), 1)
  }
  const notification = { text: data.text, value: true, color: data.color }
  state.notificationList.push(notification)
  setTimeout(() => {
    notification.value = false
  }, 6000)
}

export const SET_INVENTORY = (state: State, data: WebpickerInventory) => {
  state.inventory = data
}

export const SET_SETTINGS = (state: State, data: WebpickerSettings) => {
  state.settings = Object.assign({}, state.defaultSettings)
  for (const [k, v] of Object.entries(data)) {
    state.settings[k] = v
  }
  const stored: WebpickerSettings = {}
  for (const [k, v] of Object.entries(state.settings)) {
    if (v !== state.defaultSettings[k]) {
      stored[k] = v
    }
  }
  localStorage.setItem('settings', JSON.stringify(stored))
}

export const MERGE_INVENTORY = (state: State, data: WebpickerInventory) => {
  for (const [net, netObj] of Object.entries(data)) {
    if (state.inventory[net] == null) {
      state.inventory[net] = netObj
      continue
    }
    for (const [sta, staObj] of Object.entries(netObj)) {
      if (state.inventory[net][sta] == null) {
        state.inventory[net][sta] = staObj
        continue
      }
      for (const [loc, locObj] of Object.entries(staObj.location)) {
        if (state.inventory[net][sta].location[loc] == null) {
          state.inventory[net][sta].location[loc] = locObj
          continue
        }
        for (const [cha, chaObj] of Object.entries(locObj)) {
          if (state.inventory[net][sta].location[loc][cha] == null) {
            state.inventory[net][sta].location[loc][cha] = chaObj
          }
        }
      }
    }
  }
}

export const SET_FORM_VALUES = (state: State, data: WebpickerForm) => {
  Object.assign(state.form, data)
}

export const PICKER_DATA = (state: State, data: WebpickerOrigin) => {
  const e = state.currentEvent
  e!.preferred_magnitude_id = null
  e!.origin.push(data)
  const picks: StringIndexedObject = {}
  for (const o of e!.origin) {
    for (const a of o.arrival) {
      picks[a.pick_id] = a._pick
    }
  }
  e!.pick = Object.values(picks)
  state.currentOrigin = data
}

export const SET_TTT_CACHE = (state: State, data: TheoreticalTravelTimeObject) => {
  state.tttCache = data
}

export const SET_PICKER_LAST_ORIGIN = (state: State, data: WebpickerOrigin) => {
  state.pickerLastOrigin = data
}

export const LOG = (state: State, data: string) => {
  const now = new Date()
  state.log.push(`${now.toISOString()} | ${data}`)
}
