import type { Arrival, EventParameter, Magnitude, Origin, Pick } from '@/lib/sismojs/src/types/index'
import { DataManager, shortcutString, getId, cloneAndClean } from '@/utils'
import { processEvent } from '@/lib/sismojs/src/core/event/event'
import type { EventViewStatus } from '@/types/index'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import L from 'leaflet'

export const useAppStore = defineStore('app', () => {
  const author = ref(localStorage.getItem('author') as string | null)

  const cacheEventList = ref([] as EventParameter[])

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
  const currentEvent = ref(null as EventParameter | null)
  const currentOrigin = ref(null as Origin | null)
  const currentArrivals = ref(null as Arrival[] | null)
  const currentMagnitude = ref(null as Magnitude | null)
  const eventViewStatus = ref({
    relocateStatus: 'enabled',
    computeMagnitudesStatus: 'enabled',
    commitStatus: 'enabled'
  } as EventViewStatus)

  // Event management
  function setEvent(event: EventParameter) {
    currentEvent.value = event
    currentOrigin.value = event._po != null ? event._po : null
    currentArrivals.value = event._po != null && event._po.arrival != null ? event._po.arrival : null
    currentMagnitude.value = event._pm != null ? event._pm : null
  }
  function cloneOrigin() {
    if (currentOrigin.value == null) {
      return
    }
    const saveArrivals = currentOrigin.value.arrival || []
    currentOrigin.value.arrival = []
    const cloneEvent = processEvent({ origin: [cloneAndClean(currentOrigin.value)] } as EventParameter)
    currentOrigin.value.arrival = saveArrivals
    const cloned = cloneEvent._po as Origin
    cloned.public_id = getId('Origin')
    cloned.arrival = saveArrivals.map((x: Arrival) => x)
    currentOrigin.value = cloned
    currentArrivals.value = cloned.arrival
    eventViewStatus.value.relocateStatus = 'required'
    eventViewStatus.value.computeMagnitudesStatus = 'disabled'
    eventViewStatus.value.commitStatus = 'disabled'
  }
  function createArrival(p: Pick) {
    const netsta = `${p.waveform_id.network_code}.${p.waveform_id.station_code}`
    const ttt = dataManager.getStationPhaseTime(netsta, p.phase_hint as 'P' | 'S')
    const originPos = L.latLng([currentOrigin.value!.latitude.value, currentOrigin.value!.longitude.value])
    const stationPos = dataManager.getStationPos(netsta)
    const dist = originPos.distanceTo([stationPos!.lat, stationPos!.lon])
    const t0 = currentOrigin.value!.time._value!.getTime()
    const pTime = p.time._value!.getTime()
    const arrival: Arrival = {
      public_id: getId('Arrival'),
      time_weight: 1,
      pick_id: p.public_id,
      phase: p.phase_hint,
      _pick: p,
      _traveltime: new Date(pTime - t0),
      time_residual: (pTime - (t0 + ttt * 1e3)) / 1e3,
      distance: dist / 111e3,
      azimuth: 0
    }
    const arrivals = [...currentOrigin.value!.arrival!, arrival]
    currentOrigin.value!.arrival = arrivals
    currentArrivals.value = arrivals
  }
  function createPick(phase: string, pickTime: number, seedid: string, filter: string | undefined) {
    const ct = new Date()
    const t = new Date(pickTime)
    const [net, sta, loc, cha] = seedid.split('.')
    const pick: Pick = {
      public_id: getId('Pick'),
      time: {
        value: t.toISOString(),
        _value: t
      },
      waveform_id: {
        network_code: net,
        station_code: sta,
        location_code: loc,
        channel_code: cha
      },
      _seedid: seedid,
      _fdsnid: seedid.replace('..', '.--.'),
      phase_hint: phase,
      evaluation_mode: 'manual',
      creation_info: {
        author: author.value != null ? author.value : '',
        agency_id: 'OCA',
        creation_time: ct.toISOString(),
        _creation_time: ct
      },
      filter_id: filter
    }
    currentEvent.value!.pick!.push(pick)
    createArrival(pick)
  }
  function deletePick(pickid: string) {
    const arrivals = currentArrivals.value!.filter(a => a.pick_id !== pickid)
    currentArrivals.value = arrivals
    currentOrigin.value!.arrival = arrivals
    currentEvent.value!.pick = currentEvent.value!.pick!.filter(p => p.public_id !== pickid)
  }
  function selectArrivals(selectedArrival: Arrival[]) {
    if (currentArrivals.value == null) {
      return
    }
    const pickIdList = selectedArrival.map(x => x.pick_id)
    cloneOrigin()
    for (const arrival of currentArrivals.value) {
      if (pickIdList.indexOf(arrival.pick_id) >= 0) {
        arrival.time_weight = 1
      } else {
        arrival.time_weight = 0
      }
    }
  }

  // Application settings
  const settings = ref({
    KEYBINDING: {
      SET_PHASE_P: 'w',
      SET_PHASE_S: 's',
      ALIGN_TO_ORIGIN: 'alt+o',
      ALIGN_TO_P: 'alt+w',
      ALIGN_TO_S: 'alt+s',
      TOGGLE_FILTER: 'f',
      PICK: 'space',
      NEXT_STATION: 'a',
      PREV_STATION: 'q'
    },
    COLOR: {
      WAVEFORM: 'rgb(183 56 86)',
      ACTIVE_WAVEFORM: 'rgb(250, 250, 250)'
    },
    GENERAL: {
      WORLD_CENTER_LONGITUDE: 166
    }
  })

  return {
    author,
    cacheEventList,
    currentEvent,
    currentOrigin,
    currentArrivals,
    currentMagnitude,
    setEvent, 
    cloneOrigin,
    createPick,
    deletePick,
    createArrival,
    selectArrivals,
    eventViewStatus,
    keydownEvent,
    keydown,
    preventDefault,
    dataManager,
    settings
  }
})
