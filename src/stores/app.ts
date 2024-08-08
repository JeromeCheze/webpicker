import { Event, Origin, Magnitude, Pick, Arrival, FocalMechanism, type EvaluationMode } from '@/lib/sismojs/src/core/event/types'
import { shortcutString, getId, deepCopy, getDefault, kmToDeg, getLocalStorageDefault, setLocalStorage } from '@/utils'
import type { Activity, EventViewStatus, PickMap, WPNotificationOptions } from '@/types'
import defaultSettings from '@/utils/defaultSettings'
import ActivityManager from '@/utils/activityManager'
import DataManager from '@/utils/dataManager'
import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'

if (getLocalStorageDefault('version', null) !== 2) {
  localStorage.clear()
  setLocalStorage('version', 2)
}

const author = ref(getLocalStorageDefault('author', null) as string | null)

const notification = ref([] as WPNotificationOptions[])

const cacheEventList = ref([] as Event[])

// Utilities for keybind actions
const keydownEvent = ref(null as KeyboardEvent | null)
const keydown = computed(() => keydownEvent.value != null ? shortcutString(keydownEvent.value) : '')
function preventDefault() {
  if (keydownEvent.value != null) {
    keydownEvent.value.preventDefault()
  }
}

// Class handling inventory and waveforms data management
const dataManager = new DataManager('.')

// EventView states
const currentEvent = shallowRef(null as Event | null)
const currentOrigin = shallowRef(null as Origin | null)
const currentArrivals = shallowRef([] as Arrival[])
const currentMagnitude = shallowRef(null as Magnitude | null)
const currentFocalMechanism = shallowRef(null as FocalMechanism | null)
const currentOriginMagnitudes = shallowRef([] as Magnitude[])
const originDirty = ref(false)
const pickMap = shallowRef({} as PickMap)
const additionalPickMap = shallowRef({} as PickMap)
const eventViewStatus = ref({
  relocateStatus: 'enabled',
  computeMagnitudesStatus: 'enabled',
  commitStatus: 'enabled'
} as EventViewStatus)

// Event management
function updatePickMap() {
  const result: PickMap = {}
  for (const arrival of currentArrivals.value!) {
    const p = arrival.pickID.referredObject
    if (p != null) {
      const netsta = p.waveformID.netsta
      getDefault(result, netsta, {})
      getDefault(result[netsta], p.waveformID.seedid, []).push(p)
    }
  }
  console.log('[updatePickMap]', result)
  pickMap.value = result
}
function setEvent(event: Event) {
  console.log('[app.setEvent]', event)
  currentEvent.value = event
  currentOrigin.value = event.preferredOriginID != null ? event.preferredOriginID.referredObject : null
  if (currentOrigin.value != null) {
    currentArrivals.value = currentOrigin.value.arrival
  }
  currentOriginMagnitudes.value = event.magnitude.filter(m => m.originID.id === currentOrigin.value!.publicID)
  currentMagnitude.value = event.preferredMagnitudeID != null ? event.preferredMagnitudeID.referredObject : null
  currentFocalMechanism.value = event.preferredFocalMechanismID != null ? event.preferredFocalMechanismID.referredObject : null
  eventViewStatus.value.relocateStatus = 'enabled'
  eventViewStatus.value.computeMagnitudesStatus = 'enabled'
  eventViewStatus.value.commitStatus = 'enabled'
  dataManager.clearWaveformCache()
  dataManager.clearInventoryCache()
  dataManager.clearDistanceAzimuth()
  dataManager.clearTTTCache()
  dataManager.clearDetectorCache()
  updatePickMap()
  const e = cacheEventList.value.find(x => x.publicID === event.publicID)
  if (e != null) {
    const i = cacheEventList.value.indexOf(e)
    cacheEventList.value.splice(i, 1, event)
  } else {
    cacheEventList.value.push(event)
  }
}
function cloneOrigin() {
  if (currentOrigin.value == null) {
    return
  }
  currentOrigin.value = new Origin(
    Object.assign(
      deepCopy(currentOrigin.value.desc),
      { publicID: getId('Origin') }
    )
  )
  currentArrivals.value = currentOrigin.value.arrival
  eventViewStatus.value.relocateStatus = 'required'
  eventViewStatus.value.computeMagnitudesStatus = 'disabled'
  eventViewStatus.value.commitStatus = 'disabled'
  originDirty.value = true
  console.log('[app.cloneOrigin]', currentOrigin.value)
}
function createArrival(p: Pick) {
  const netsta = p.waveformID.netsta
  const ttt = dataManager.getStationPhaseTime(currentOrigin.value!.time.object.getTime(), netsta, p.phaseHint as 'P' | 'S')
  const pTime = p.time.object.getTime()
  const arrivalDesc = {
    '@publicID': getId('Arrival'),
    timeWeight: 1,
    pickID: p.publicID,
    phase: p.phaseHint,
    timeResidual: (pTime - ttt) / 1e3,
    distance: kmToDeg(dataManager.getStationDistance(netsta)),
    azimuth: dataManager.getStationAzimuth(netsta)
  }
  console.log('create arrival', arrivalDesc)
  currentOrigin.value!.addArrival(arrivalDesc)
  currentArrivals.value = currentOrigin.value!.arrival.map(x => x)
  console.log('[app.createArrivals]', arrivalDesc)
}
function createPick(phase: string, pickTime: number, seedid: string, filter: string | undefined): Pick {
  if (!originDirty.value) {
    cloneOrigin()
  }
  const ct = new Date()
  const t = new Date(pickTime)
  const [networkCode, stationCode, loc, channelCode] = seedid.split('.')
  const locationCode = loc === '' ? undefined : loc
  const pickDesc = {
    '@publicID': getId('Pick'),
    time: { value: t.toISOString() },
    waveformID: {
      '@networkCode': networkCode,
      '@stationCode': stationCode,
      '@locationCode': locationCode,
      '@channelCode': channelCode
    },
    phaseHint: phase,
    evaluationMode: 'manual' as EvaluationMode,
    creationInfo: {
      author: author.value != null ? author.value : '',
      agencyID: 'OCA',
      creationTime: ct.toISOString()
    },
    filterID: filter?.replace(' ', '_').replace(':', '_')
  }
  console.log('create pick', pickDesc)
  const pick = currentEvent.value!.addPick(pickDesc)
  createArrival(pick)
  updatePickMap()
  return pick
}
function deletePick(pick: Pick) {
  const arrival = currentArrivals.value!.find(x => x.pickID.id === pick.publicID)
  if (arrival != null) {
    currentOrigin.value!.deleteArrival(arrival)
  }
  let canBeDeleted = true
  for (const origin of currentEvent.value!.origin) {
    for (const arrival of origin.arrival) {
      if (arrival.pickID.id === pick.publicID) {
        canBeDeleted = false
        break
      }
    }
  }
  // delete pick only if it is not referred by another arrival
  if (canBeDeleted) {
    console.log('[app.deletePick]', pick)
    currentEvent.value!.deletePick(pick)
  }
  currentArrivals.value = currentOrigin.value!.arrival.map(x => x)
  updatePickMap()
}
function selectArrivals(selectedArrivals: Arrival[]) {
  if (!originDirty.value) {
    cloneOrigin()
  }
  const pickIdList = selectedArrivals.map(x => x.pickID.id)
  if (currentArrivals.value == null) {
    console.warn('no arrivals')
    return
  }
  console.log('[app.selectedArrivals]', selectedArrivals)
  for (const arrival of currentArrivals.value) {
    arrival.timeWeight = pickIdList.indexOf(arrival.pickID.id) < 0 ? 0 : 1
  }
  currentArrivals.value = currentArrivals.value.map(x => x)
}
function createFocalMechanism(strike: number, dip: number, rake: number, nbStation: number) {
  currentFocalMechanism.value = new FocalMechanism({
    '@publicID': getId('FocalMechanism'),
    triggeringOriginID: currentOrigin.value!.publicID,
    stationPolarityCount: nbStation,
    evaluationMode: 'manual',
    nodalPlanes: {
      nodalPlane1: {
        strike: { value: strike },
        dip: { value: dip },
        rake: { value: rake }
      }
    }
  })
  eventViewStatus.value.commitStatus = 'required'
}

// Load application settings
const settings = Object.assign(deepCopy(defaultSettings), getLocalStorageDefault('settings', {}))

const usersActivity = ref([] as Activity[])
const connected = ref(false)
const activityManager = new ActivityManager(
  author.value || 'unknown user',
  value => usersActivity.value = value,
  value => connected.value = value
)

export const useAppStore = defineStore('app', () => {
  return {
    connected,
    author,
    notification,
    cacheEventList,
    currentEvent,
    currentOrigin,
    currentArrivals,
    currentMagnitude,
    currentFocalMechanism,
    currentOriginMagnitudes,
    pickMap,
    additionalPickMap,
    updatePickMap,
    setEvent, 
    cloneOrigin,
    createPick,
    deletePick,
    createArrival,
    createFocalMechanism,
    selectArrivals,
    eventViewStatus,
    keydownEvent,
    keydown,
    preventDefault,
    dataManager,
    activityManager,
    usersActivity,
    settings
  }
})
