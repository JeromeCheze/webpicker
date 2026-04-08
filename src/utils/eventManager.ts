import { QArrival, QFocalMechanism, QOrigin, QPick, QResourceIdentifier, QStationMagnitude, type QEvaluationMode, QEvent, type QMagnitude, type QOriginDescription, type QPickDescription, type QTypeCertainty, type QEvaluationStatus } from '@/lib/sismojs/src/core/event/types'
import { deepCopy, DISCARDED_EVENT_TYPES, getDefault, getId, kmToDeg } from '.'
import type { FDSNEventParams } from '@/lib/sismojs/src/types'
import type { EventViewStatus, PickMap } from '@/types'
import { Client } from '@/lib/sismojs/src/fdsn'
import type DataManager from './dataManager'

interface EventManagerCurrent {
  event: QEvent | null
  origin: QOrigin | null
  arrivals: QArrival[]
  magnitude: QMagnitude | null
  originMagnitudes: QMagnitude[]
  focalMechanism: QFocalMechanism | null
  userPicks: QPick[]
  type?: string
  typeCertainty?: QTypeCertainty
  evaluationStatus?: QEvaluationStatus
}

const eventManagerCurrentLogHandler: ProxyHandler<EventManagerCurrent> = {
  get(t, k, r) {
    return Reflect.get(t, k, r)
  },
  set (t, k, v, r) {
    const txtValue = v instanceof Array
      ? v.map(x => x.publicID)
      : typeof v === 'string'
        ? v
        : v.publicID
    console.log(`[EventManager.current] set ${k.toString()} = ${JSON.stringify(txtValue)}`)
    Reflect.set(t, k, v, r)
    return true
  }
}

const eventManagerStatusLogHandler: ProxyHandler<EventViewStatus> = {
  get(t, k, r) {
    return Reflect.get(t, k, r)
  },
  set (t, k, v, r) {
    console.log(`[EventManager.status] set ${k.toString()} = ${JSON.stringify(v)}`)
    Reflect.set(t, k, v, r)
    return true
  }
}

export default class EventManager {
  _events: QEvent[]
  client: Client
  current: EventManagerCurrent
  status: EventViewStatus
  pickMap: PickMap
  additionalPickMap: PickMap
  dataManager: DataManager
  agencyID: string
  updateEventsCallback: (events: QEvent[]) => void

  constructor(
    dataManager: DataManager,
    updateEventsCallback: (events: QEvent[]) => void
  ) {
    this._events = []
    this.dataManager = dataManager
    this.client = new Client('.')
    this.updateEventsCallback = updateEventsCallback
    this.current = new Proxy<EventManagerCurrent>({
      event: null,
      origin: null,
      arrivals: [],
      magnitude: null,
      focalMechanism: null,
      originMagnitudes: [],
      userPicks: []
    }, eventManagerCurrentLogHandler)
    this.status = new Proxy<EventViewStatus>({
      relocate: 'enabled',
      computeMagnitudes: 'enabled',
      commit: 'enabled'
    }, eventManagerStatusLogHandler)
    this.pickMap = {}
    this.additionalPickMap = {}
    this.agencyID = 'OCA'
  }

  get events() {
    return this._events
  }
  set events(value: QEvent[]) {
    this._events = value
    this.updateEventsCallback(value)
  }

  updatePickMap() {
    const result: PickMap = {}
    if (this.current.origin != null) {
      for (const arrival of this.current.origin.arrival) {
        const p = arrival.pickID.referredObject
        if (p != null) {
          const netsta = p.waveformID.netsta
          getDefault(result, netsta, {})
          getDefault(result[netsta], p.waveformID.seedid, []).push(p)
        }
      }
    }
    console.log('[EventManager.updatePickMap]')
    this.pickMap = result
  }

  setEvent(event: QEvent) {
    console.log('[EventManager.setEvent]')
    this.current.origin = event.preferredOriginID?.referredObject
    this.current.magnitude = event.preferredMagnitudeID?.referredObject
    this.current.focalMechanism = event.preferredFocalMechanismID?.referredObject
    this.current.originMagnitudes = []
    this.current.arrivals = []
    if (this.current.origin != null) {
      if (event.magnitude != null) {
        this.current.originMagnitudes = event.magnitude.filter(m => m.originID.id === this.current.origin!.publicID)
      }
      this.current.arrivals = this.current.origin.arrival.map(a => a)
    }
    this.current.type = event.type
    this.current.typeCertainty = event.typeCertainty
    this.current.evaluationStatus = this.current.origin?.evaluationStatus
    this.status.relocate = 'enabled'
    this.status.computeMagnitudes = 'enabled'
    this.status.commit = 'enabled'
    this.dataManager.reset()
    this.updatePickMap()
    this.current.event = event
  }

  updateEvent(baseUrl: string, eventid: string) {
    return new Promise<void>((resolve, reject) => {
      this.client.baseURL = baseUrl
      if (this.current.event != null && this.current.event.publicID === eventid) {
        this.loadEvent(baseUrl, eventid)
        resolve()
      } else {
        this.client.getEvents({
          eventid,
          format: 'xml',
          includefocalmechanism: true
        }).then(events => {
          if (events.length > 0) {
            const e = events[0]
            this.events = this.events.map(x => x.publicID === e.publicID ? e : x)
          }
          resolve()
        })
      }
    })
  }

  buildCurrentEvent() {
    const saveMainKey = QResourceIdentifier.mainKey
    QResourceIdentifier.mainKey = 'sandbox'
    const event = new QEvent(deepCopy(this.current.event!.desc))
    for (const pick of this.current.userPicks) {
      event.addPick(pick.desc)
    }
    if (event.origin.find(x => x.publicID === this.current.origin!.publicID) == null) {
      event.addOrigin(this.current.origin!.desc)
      event.setPreferredOriginID(this.current.origin!.publicID)
    }
    for (const m of this.current.originMagnitudes) {
      if (event.magnitude.find(x => x.publicID === m.publicID) == null) {
        event.addMagnitude(m.desc)
        if (m.stationMagnitudeContribution != null) {
          for (const smc of m.stationMagnitudeContribution) {
            const staMag: QStationMagnitude = smc.stationMagnitudeID.referredObject
            if (event.stationMagnitude.find(x => x.publicID === staMag.publicID) == null) {
              event.addStationMagnitude(staMag.desc)
            }
            if (staMag.amplitudeID != null) {
              const amp = staMag.amplitudeID.referredObject
              if (event.amplitude.find(x => x.publicID === amp.publicID) == null) {
                event.addAmplitude(amp.desc)
              }
            }
          }
        }
      }
    }
    if (this.current.magnitude != null) {
      event.setPreferredMagnitudeID(this.current.magnitude.publicID)
    } else {
      event.setPreferredMagnitudeID(undefined)
    }
    if (this.current.focalMechanism != null) {
      if (event.focalMechanism.find(x => x.publicID === this.current.focalMechanism!.publicID) == null) {
        event.addFocalMechanism(this.current.focalMechanism.desc)
      }
      event.setPreferredFocalMechanismID(this.current.focalMechanism.publicID)
    }
    event.type = this.current.type
    event.typeCertainty = this.current.typeCertainty
    event.preferredOriginID.referredObject.evaluationStatus = this.current.evaluationStatus
    QResourceIdentifier.mainKey = saveMainKey
    return event
  }

  getCatalogs(baseUrl: string) {
    console.log('[EventManager.loadCatalogs]')
    return new Promise<string[]>((resolve, _) => {
      fetch(`${baseUrl}/fdsnws/event/1/catalogs`).then(response => {
        if (response.status === 200) {
          response.text().then(text => {
            const doc = new DOMParser().parseFromString(text, 'application/xml')
            const result: string[] = []
            for (const catalog of doc.querySelectorAll('Catalog')) {
              result.push(catalog.textContent as string)
            }
            resolve(result)
          })
        }
      })
    })
  }

  loadEvents(baseUrl: string, params: FDSNEventParams) {
    console.log(`[EventManager.loadEvents] ${JSON.stringify(params)}`)
    return new Promise<void>((resolve, reject) => {
      this.client.baseURL = baseUrl
      this.client.getEvents(params).then(events => {
        this.events = events
        resolve()
      })
    })
  }

  loadEvent(baseUrl: string, eventid: string) {
    const params = {
      eventid,
      includearrivals: true,
      includeallorigins: true,
      includeallmagnitudes: true,
      includefocalmechanism: true,
      includestationmagnitudes: true
    }
    console.log(`[EventManager.loadEvent] ${JSON.stringify(params)}`)
    return new Promise<void>((resolve, reject) => {
      this.client.baseURL = baseUrl
      this.client.getEvents(params).then(events => {
        if (events.length > 0) {
          const event = this.events.find(e => e.publicID === events[0].publicID)
          if (event != null) {
            this.events.splice(this.events.indexOf(event), 1, events[0])
          }
          this.setEvent(events[0])
          resolve()
        } else {
          reject('Event not found')
        }
      })
    })
  }

  loadAdditionalPicks(baseUrl: string, t: number) {
    const saveMainKey = QResourceIdentifier.mainKey
    QResourceIdentifier.mainKey = 'sandbox'
    const saveWarn = console.warn
    console.warn = () => {}
    const params = {
      format: 'xml',
      starttime: new Date(t - 3600e3).toISOString().slice(0, 19),
      endtime: new Date(t + 3600e3).toISOString().slice(0, 19),
      includeallorigins: true,
      includearrivals: true
    }
    console.log(`[EventManager.loadAdditionalPicks] ${JSON.stringify(params)}`)
    this.client.baseURL = baseUrl
    this.client.getEvents(params).then((events) => {
      const additionalPickMap: PickMap = {}
      for (const event of events) {
        if (this.current.event != null && event.publicID === this.current.event.publicID) {
          continue
        }
        if (event.type != null && DISCARDED_EVENT_TYPES.indexOf(event.type) >= 0) {
          continue
        }
        // for (const pick of event.pick) {
        for (const arrival of event.preferredOriginID.referredObject.arrival) {
          if (arrival.timeWeight === 0) {
            continue
          }
          const pick = arrival.pickID.referredObject
          const netsta = pick.waveformID.netsta
          const seedid = pick.waveformID.seedid
          if (additionalPickMap[netsta] == null) {
            additionalPickMap[netsta] = {}
          }
          if (additionalPickMap[netsta][seedid] == null) {
            additionalPickMap[netsta][seedid] = []
          }
          additionalPickMap[netsta][seedid].push(pick)
        }
      }
      this.additionalPickMap = additionalPickMap
    }).finally(() => {
      // Restore the original mainKey of ResourceIdentifier
      QResourceIdentifier.mainKey = saveMainKey
      console.warn = saveWarn
    })
  }

  cloneOrigin() {
    this.current.magnitude = null
    this.current.originMagnitudes = []
    this.current.focalMechanism = null
    this.status.relocate = 'required'
    this.status.computeMagnitudes = 'disabled'
    this.status.commit = 'disabled'
    if (this.current.event!.origin.find(o => o.publicID === this.current.origin!.publicID) == null) {
      // origin is already dirty, no need to clone
      return
    }
    const clonedDesc = deepCopy(this.current.origin!.desc) as QOriginDescription
    const newOriginID = getId('Origin')
    clonedDesc['@publicID'] = newOriginID
    for (const arrival of clonedDesc.arrival) {
      arrival['@publicID'] = `${arrival.pickID}_${newOriginID}`
    }
    console.log(`[EventManager.cloneOrigin] ${JSON.stringify(clonedDesc)}`)
    this.current.origin = new QOrigin(clonedDesc, this.current.event!.id)
    this.current.arrivals = this.current.origin.arrival.map(a => a)
  }

  deleteArrival(pick: QPick) {
    this.cloneOrigin()
    const arrival = this.current.origin!.arrival.find(a => a.pickID.id === pick.publicID)
    if (arrival != null) {
      this.current.origin!.deleteArrival(arrival)
    }
    this.current.arrivals = this.current.origin!.arrival.map(a => a)
  }
  
  deletePick(pick: QPick) {
    const p = this.current.userPicks.find(p => p.publicID === pick.publicID)
    if (p != null) {
      this.current.userPicks.splice(this.current.userPicks.indexOf(p), 1)
      console.log(`[EventManager.deletePick] ${JSON.stringify(p.desc)}`)
    }
    this.deleteArrival(pick)
    this.updatePickMap()
  }

  createArrival(pick: QPick) {
    this.cloneOrigin()
    const netsta = pick.waveformID.netsta
    const ttt = this.dataManager.getStationPhaseTime(
      this.current.origin!.time.object.getTime(),
      netsta,
      pick.phaseHint as 'P' | 'S'
    )
    const pTime = pick.time.object.getTime()
    this.current.origin!.addArrival({
      '@publicID': `${pick.publicID}_${this.current.origin!.publicID}`,
      timeWeight: 1,
      pickID: pick.publicID,
      phase: pick.phaseHint,
      timeResidual: (pTime - ttt) / 1e3,
      distance: kmToDeg(this.dataManager.getStationDistance(netsta)),
      azimuth: this.dataManager.getStationAzimuth(netsta)
    })
    this.current.arrivals = this.current.origin!.arrival.map(a => a)
  }

  createPick(phase: string, pickTime: number, seedid: string, filter: string | undefined, author: string) {
    const ct = new Date()
    const t = new Date(pickTime)
    const [networkCode, stationCode, loc, channelCode] = seedid.split('.')
    const locationCode = loc === '' ? undefined : loc
    const pick = new QPick({
      '@publicID': getId('Pick'),
      time: { value: t.toISOString() },
      waveformID: {
        '@networkCode': networkCode,
        '@stationCode': stationCode,
        '@locationCode': locationCode,
        '@channelCode': channelCode
      },
      phaseHint: phase,
      evaluationMode: 'manual' as QEvaluationMode,
      creationInfo: {
        author: author,
        agencyID: this.agencyID,
        creationTime: ct.toISOString()
      },
      filterID: filter?.replace(' ', '_').replace(':', '_')
    }, this.current.event!.id)
    console.log(`[EventManager.createPick] ${JSON.stringify(pick.desc)}`)
    this.current.userPicks.push(pick)
    this.createArrival(pick)
    this.updatePickMap()
    return pick
  }

  clonePick(pick: QPick, author: string) {
    this.deletePick(pick)
    const clonedDesc = deepCopy(pick.desc) as QPickDescription
    clonedDesc['@publicID'] = getId('Pick')
    clonedDesc.creationInfo = {
      author: author,
      creationTime: new Date().toISOString(),
      agencyID: this.agencyID
    }
    clonedDesc.evaluationMode = 'manual'
    const newPick = new QPick(clonedDesc, this.current.event!.id)
    console.log(`[EventManager.clonePick] ${JSON.stringify(newPick.desc)}`)
    this.current.userPicks.push(newPick)
    this.createArrival(newPick)
    this.updatePickMap()
    return newPick
  }

  selectArrivals(arrivals: QArrival[]) {
    this.cloneOrigin()
    const pickIdList = arrivals.map(a => a.pickID.id)
    for (const arrival of this.current.origin!.arrival) {
      arrival.timeWeight = pickIdList.indexOf(arrival.pickID.id) < 0 ? 0 : 1
    }
    this.current.arrivals = this.current.origin!.arrival.map(a => a)
  }

  createFocalMechanism(strike: number, dip: number, rake: number, nbStation: number, author: string) {
    this.current.focalMechanism = new QFocalMechanism({
      '@publicID': getId('FocalMechanism'),
      triggeringOriginID: this.current.origin!.publicID,
      stationPolarityCount: nbStation,
      evaluationMode: 'manual',
      nodalPlanes: {
        nodalPlane1: {
          strike: { value: strike },
          dip: { value: dip },
          rake: { value: rake }
        }
      },
      creationInfo: {
        author: author,
        agencyID: this.agencyID,
        creationTime: new Date().toISOString()
      }
    }, this.current.event!.id)
    this.current.event!.setPreferredFocalMechanismID(this.current.focalMechanism.publicID)
    this.status.commit = 'required'
    console.log(`[EventManager.createFocalMechanism] ${JSON.stringify(this.current.focalMechanism.desc)}`)
  }

}
