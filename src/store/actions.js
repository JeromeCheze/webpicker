import utils from '@/utils/utils'

export const initialize = ({ commit }) => {
  commit('INITIALIZE')
}

export const eventList = ({ commit }, data) => {
  commit('SET_EVENT_LIST', data)
}

export const selectEvent = ({ commit }, data) => {
  commit('SET_SELECTED_EVENT_CODE', data)
}

export const setCurrentEvent = ({ commit }, data) => {
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

export const setAuthor = ({ commit }, data) => {
  commit('SET_AUTHOR', data)
}
