import { AuthorStatus, GenericAction, WebpickerInventory } from '@/types'
import * as utils from '@/utils/utils'

export const initialize: GenericAction = ({ commit, dispatch }) => {
  let end = new Date(new Date().getTime() + 86400e3).getTime()
  let start = new Date(end - 86400e3 * 8)
  let savedFormValues = JSON.parse(localStorage.getItem('form') || "{}")
  let formValues = Object.assign({
    start: start.toISOString().slice(0, 10),
    end: new Date(end).toISOString().slice(0, 10)
  }, savedFormValues)
  commit('INIT_FORM', formValues)
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

export const updateAuthorStatus: GenericAction = ({ commit, getters, dispatch }) => {
  return new Promise(function(resolve) {
    utils.ajax({
      method: 'GET',
      url: getters.getLink('author_status'),
      type: 'json'
    }).then(response => {
      const data = response as AuthorStatus
      if (data.__message__ != null) {
        let msgMap = data.__message__
        let ackMsg = getters.getAcknowledgedMsgIds
        let eventIds = getters.getEventListIds
        delete data.__message__
        for (let [msgId, msg] of Object.entries(msgMap)) {
          if (ackMsg.indexOf(msgId) < 0) {
            commit('ADD_NOTIFICATION', { color: 'info', text: `author ${msg.author} just ${msg.action} event ${msg.eventid}`})
            commit('ACKNOWLEDGE_MESSAGE', msgId)
            if (msg.action === 'commit' && eventIds.indexOf(msg.eventid) >= 0) {
              commit('SET_EVENT_LIST_DIRTY', true)
            }
          }
        }
      }
      commit('SET_AUTHOR_STATUS', data)
      setTimeout(() => {
        dispatch('updateAuthorStatus')
      }, 5000)
      resolve(null)
    }).catch(data => {
      commit('LOG', `[store.action::updateAuthorStatus] request failed: ${data}`)
    })
  });
}

export const setAuthorStatus: GenericAction = ({ commit, getters }, data) => {
  return new Promise(function(resolve, reject) {
    utils.ajax({
      method: 'GET',
      url: getters.getLink('author_status'),
      args: { eventid: data.eventid, action: data.action },
      type: 'json'
    }).then(data => {
      console.log('[store.action::setAuthorStatus] response', data);
      resolve(null)
    }).catch(data => {
      commit('LOG', `[store.action::setAuthorStatus] request failed: ${data}`)
    })
  });
}

export const eventList: GenericAction = ({ commit }, data) => {
  commit('SET_EVENT_LIST', data)
}

export const setCurrentEvent: GenericAction = ({ commit, getters }, data) => {
  let activity = getters.getEventActivity
  if (activity[data.public_id] != null) {
    commit('ALERT_EVENT_LOCKED', activity[data.public_id])
  }
  commit('SET_CURRENT_EVENT', data)
}

export const setCurrentOrigin: GenericAction = ({ commit }, data) => {
  commit('SET_CURRENT_ORIGIN', data)
}

export const setCurrentFocalMechanism: GenericAction = ({ commit }, data) => {
  commit('SET_CURRENT_FOCAL_MECHANISM', data)
}

export const setLoading: GenericAction = ({ commit }, data) => {
  commit('SET_LOADING', data)
}

export const notify: GenericAction = ({ commit }, data) => {
  commit('ADD_NOTIFICATION', data)
}

export const setInventory: GenericAction = ({ commit }, data: WebpickerInventory) => {
  commit('SET_INVENTORY', data)
}

export const setSettings: GenericAction = ({ commit }, data) => {
  commit('SET_SETTINGS', data)
}

export const mergeInventory: GenericAction = ({ commit }, data) => {
  commit('MERGE_INVENTORY', data)
}

export const setFormValues: GenericAction = ({ commit }, data) => {
  commit('SET_FORM_VALUES', data)
}

export const pickerData: GenericAction = ({ state, commit, getters }, data) => {
  let o = Object.assign({}, state.currentOrigin)
  o._not_committed = true
  o._is_dirty = true
  o.public_id = getters.getId('Origin')
  o.arrival = data
  commit('PICKER_DATA', o)
}

export const setAuthor: GenericAction = ({ commit }, data) => {
  commit('SET_AUTHOR', data)
}

export const setTTTCache: GenericAction = ({ commit }, data) => {
  commit('SET_TTT_CACHE', data)
}

export const setPickerLastOrigin: GenericAction = ({ commit }, data) => {
  commit('SET_PICKER_LAST_ORIGIN', data)
}

export const log: GenericAction = ({ commit }, data) => {
  commit('LOG', data)
}