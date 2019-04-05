export const INITIALIZE = (state) => {
  let end = new Date(new Date().getTime() + 86400e3)
  let start = new Date(end - 86400e3 * 8)
  state.form.starttime = start.toISOString().slice(0, 10)
  state.form.endtime = end.toISOString().slice(0, 10)

  let storedSettings = localStorage.getItem('settings')
  state.settings = Object.assign(state.settings, storedSettings != null ? JSON.parse(storedSettings) : {})
}

export const SET_EVENT_LIST = (state, data) => {
  state.eventList = data
}

export const SET_SELECTED_EVENT_CODE = (state, data) => {
  state.selectedEventCode = data
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

export const SET_CURRENT_ORIGIN = (state, data) => {
  state.currentOrigin = data
}

export const SET_LOADING = (state, data) => {
  state.loading = data.value
  state.loadingMsg = data.text || 'Loading...'
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
  localStorage.setItem('settings', stored)
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
