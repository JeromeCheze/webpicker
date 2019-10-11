import utils from '@/utils/utils'

export const INIT_FORM = (state, data) => {
  state.form.start = data.start.toISOString().slice(0, 10)
  state.form.end = data.end.toISOString().slice(0, 10)
}

export const SET_AUTHOR = (state, data) => {
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
  })
}

export const SET_AUTHOR_STATUS = (state, data) => {
  let dirty = false
  for (let [k, v] of Object.entries(data)) {
    if (state.authorStatus[k] == null) {
      dirty = true
      break
    } else {
      for (let [k2, v2] of Object.entries(v)) {
        if (state.authorStatus[k][k2] != v2) {
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
    for (let [k, v] of Object.entries(state.authorStatus)) {
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

export const SET_AUTHOR_DIALOG = (state, data) => {
  state.authorDialog = data
}

export const SET_EVENT_LIST = (state, data) => {
  state.eventList = data
}

export const SET_CURRENT_EVENT = (state, data) => {
  let oldEvent = state.eventList.find(x => x.public_id == data.public_id)
  let index = state.eventList.indexOf(oldEvent)
  if (oldEvent != null) {
    state.eventList.splice(index, 1, data)
    let notCommitted = oldEvent.origin.find(o => o._not_committed == true)
    let foundOrigin = notCommitted != null ? data.origin.find(o => o.public_id == notCommitted.public_id) : null
    if (notCommitted != null && foundOrigin == null) {
      data.origin.push(notCommitted)
      state.currentOrigin = notCommitted
    } else {
      state.currentOrigin = data._po
    }
    state.currentEvent = data
  } else {
    state.eventList.push(data)
    state.currentOrigin = data._po
    state.currentEvent = data
  }
}

export const ALERT_EVENT_LOCKED = (state, data) => {
  state.alertEventLocked = data
  state.alertEventLockedDialog = true
}

export const SET_CURRENT_ORIGIN = (state, data) => {
  state.currentOrigin = data
}

export const SET_LOADING = (state, data) => {
  state.loading = data.value
  state.loadingMsg = data.text || 'Loading...'
}

export const ADD_NOTIFICATION = (state, data) => {
  let outdated = state.notificationList.filter(x => !x.value)
  for (let notification of outdated) {
    state.notificationList.splice(state.notificationList.indexOf(notification), 1)
  }
  let notification = { text: data.text, value: true, color: data.color }
  state.notificationList.push(notification)
  setTimeout(() => {
    notification.value = false
  }, 6000)
}

export const SET_INVENTORY = (state, data) => {
  state.inventory = data
}

export const SET_SETTINGS = (state, data) => {
  state.settings = Object.assign({}, state.defaultSettings)
  for (let [k, v] of Object.entries(data)) {
    state.settings[k] = v
  }
  let stored = {}
  for (let [k, v] of Object.entries(state.settings)) {
    if (v != state.defaultSettings[k]) {
      stored[k] = v
    }
  }
  localStorage.setItem('settings', JSON.stringify(stored))
}

export const MERGE_INVENTORY = (state, data) => {
  for (let [net, netObj] of Object.entries(data)) {
    if (state.inventory[net] == null) {
      state.inventory[net] = netObj
      continue
    }
    for (let [sta, staObj] of Object.entries(netObj)) {
      if (state.inventory[net][sta] == null) {
        state.inventory[net][sta] = staObj
        continue
      }
      for (let [loc, locObj] of Object.entries(staObj.location)) {
        if (state.inventory[net][sta].location[loc] == null) {
          state.inventory[net][sta].location[loc] = locObj
          continue
        }
        for (let [cha, chaObj] of Object.entries(locObj)) {
          if (state.inventory[net][sta].location[loc][cha] == null) {
            state.inventory[net][sta].location[loc][cha] = chaObj
          }
        }
      }
    }
  }
}

export const SET_FORM_VALUES = (state, data) => {
  Object.assign(state.form, data)
}

export const PICKER_DATA = (state, data) => {
  let e = state.currentEvent
  e.preferred_magnitude_id = null
  e.origin.push(data)
  let picks = {}
  for (let o of e.origin) {
    for (let a of o.arrival) {
      picks[a.pick_id] = a._pick
    }
  }
  e.pick = Object.values(picks)
  state.currentOrigin = data
}
