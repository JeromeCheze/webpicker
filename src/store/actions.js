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

export const setInventory = ({ commit }, data) => {
  commit('SET_INVENTORY', data)
}

export const setSettings = ({ commit }, data) => {
  commit('SET_SETTINGS', data)
}

export const mergeInventory = ({ commit }, data) => {
  commit('MERGE_INVENTORY', data)
}
