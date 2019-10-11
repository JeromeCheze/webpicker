import utils from '@/utils/utils'

export const initialize = ({ commit, dispatch }) => {
  let end = new Date(new Date().getTime() + 86400e3)
  let start = new Date(end - 86400e3 * 8)
  commit('INIT_FORM', { start, end })
  let storedSettings = localStorage.getItem('settings')
  commit('SET_SETTINGS', storedSettings != null ? JSON.parse(storedSettings) : {})
  let author = localStorage.getItem('author')
  if (author != null) {
    commit('SET_AUTHOR', { author, remember: true })
  } else {
    commit('SET_AUTHOR_DIALOG', true)
  }
  dispatch('updateAuthorStatus')
}

export const updateAuthorStatus = ({ commit, getters, dispatch }) => {
  return new Promise(function(resolve, reject) {
    utils.ajax({
      method: 'GET',
      url: getters.getLink('author_status'),
      type: 'json'
    }).then(data => {
      commit('SET_AUTHOR_STATUS', data)
      setTimeout(() => {
        dispatch('updateAuthorStatus')
      }, 5000)
      resolve()
    })
  });
}

export const setAuthorStatus = ({ getters }, data) => {
  return new Promise(function(resolve, reject) {
    utils.ajax({
      method: 'GET',
      url: getters.getLink('author_status'),
      args: { eventid: data.eventid, action: data.action },
      type: 'json'
    }).then(data => {
      console.log('[store.action::setAuthorStatus] response', data);
      resolve()
    })
  });
}

export const eventList = ({ commit }, data) => {
  commit('SET_EVENT_LIST', data)
}

export const setCurrentEvent = ({ commit, getters }, data) => {
  let activity = getters.getEventActivity
  if (activity[data.public_id] != null) {
    commit('ALERT_EVENT_LOCKED', activity[data.public_id])
  }
  commit('SET_CURRENT_EVENT', data)
}

export const setCurrentOrigin = ({ commit }, data) => {
  commit('SET_CURRENT_ORIGIN', data)
}

export const setLoading = ({ commit }, data) => {
  commit('SET_LOADING', data)
}

export const notify = ({ commit }, data) => {
  commit('ADD_NOTIFICATION', data)
}

export const setInventory = ({ commit }, data) => {
  commit('SET_INVENTORY', data)
}

export const setSettings = ({ commit }, data) => {
  commit('SET_SETTINGS', data)
}

export const mergeInventory = ({ commit }, data) => {
  commit('MERGE_INVENTORY', data)
}

export const setFormValues = ({ commit }, data) => {
  commit('SET_FORM_VALUES', data)
}

export const pickerData = ({ state, commit, getters }, data) => {
  let o = Object.assign({}, state.currentOrigin)
  o._not_committed = true
  o._is_dirty = true
  o.public_id = getters.getId('Origin')
  o.arrival = data
  commit('PICKER_DATA', o)
}

export const setAuthor = ({ commit, getters }, data) => {
  commit('SET_AUTHOR', data)
}
