import type { FDSNStationBulkItem, FDSNWaveformBulkItem, Inventory } from '@/lib/sismojs/src/types'
import type { Detection, DetectionResult, TTT, WPNotificationOptions } from '@/types'
import { Stream, type Trace } from "@/lib/sismojs/src/core/waveform"
import { getDistanceAzimuth, pushUnique, toNetSta } from '@/utils'
import { type QArrival } from '@/lib/sismojs/src/core/event/types'
import { Client } from "@/lib/sismojs/src/fdsn"

const CHUNK_LENGTH = 12

export default class DataManager {

  client: Client
  inventoryCache: Inventory
  waveformCache: { [fdsnid: string]: { [timewindow: string]: Trace } }
  tttCache: TTT
  stationDistance: { [netsta: string]: number }
  stationAzimuth: { [netsta: string]: number }
  detectorCache: Record<string, Detection[]>

  constructor() {
    this.client = new Client('.')
    this.inventoryCache = {}
    this.waveformCache = {}
    this.tttCache = {}
    this.stationDistance = {}
    this.stationAzimuth = {}
    this.detectorCache = {}
  }

  getWaveformCache(key1: string, key2: string): Trace | null {
    if (this.waveformCache[key1] != null) {
      return this.waveformCache[key1][key2]
    }
    return null
  }

  setWaveformCache(key1: string, key2: string, value: Trace) {
    if (this.waveformCache[key1] == null) {
      this.waveformCache[key1] = {}
    }
    this.waveformCache[key1][key2] = value
  }

  clearWaveformCache() {
    this.waveformCache = {}
  }

  clearInventoryCache() {
    this.inventoryCache = {}
  }

  clearDistanceAzimuth() {
    this.stationDistance = {}
    this.stationAzimuth = {}
  }

  clearTTTCache() {
    this.tttCache = {}
  }

  clearDetectorCache() {
    this.detectorCache = {}
  }

  reset() {
    this.clearWaveformCache()
    this.clearDetectorCache()
    this.clearInventoryCache()
    this.clearDistanceAzimuth()
    this.clearTTTCache()
  }

  updateStationDistanceAzimuth(oLat: number, oLon: number) {
    console.log('[DataManager.updateStationDistanceAzimuth]')
    for (const [net, staMap] of Object.entries(this.inventoryCache)) {
      for (const [sta, staObj] of Object.entries(staMap)) {
        const netsta = `${net}.${sta}`
        const [dist, az] = getDistanceAzimuth(oLat, oLon, staObj.lat, staObj.lon)
        this.stationDistance[netsta] = dist
        this.stationAzimuth[netsta] = az
      }
    }
  }

  getStationDistance(netsta: string) {
    return this.stationDistance[netsta]
  }

  getStationAzimuth(netsta: string) {
    return this.stationAzimuth[netsta]
  }

  mergeInventory(inv: Inventory) {
    for (const [net, staMap] of Object.entries(inv)) {
      if (this.inventoryCache[net] == null) {
        this.inventoryCache[net] = staMap
        continue
      }
      for (const [sta, staObj] of Object.entries(staMap)) {
        if (this.inventoryCache[net][sta] == null) {
          this.inventoryCache[net][sta] = staObj
          continue
        }
        for (const [loc, chaMap] of Object.entries(staObj.location)) {
          if (this.inventoryCache[net][sta].location[loc] == null) {
            this.inventoryCache[net][sta].location[loc] = chaMap
            continue
          }
          for (const [cha, chaList] of Object.entries(chaMap)) {
            if (this.inventoryCache[net][sta].location[loc][cha] == null) {
              this.inventoryCache[net][sta].location[loc][cha] = chaList
              continue
            }
            for (const info of chaList) {
              this.inventoryCache[net][sta].location[loc][cha].push(info)
            }
          }
        }
      }
    }
  }

  getInventory(
    baseUrl: string,
    seedidList: string[],
    time: number,
    notification: (opt: WPNotificationOptions) => void
  ): Promise<Inventory> {
    const t = new Date(time)
    console.log(`[DataManager.getInventory] ${new Date(time).toISOString()} | ${JSON.stringify(seedidList)}`)
    return new Promise((resolve, reject) => {
      notification({ type: 'progress', value: { text: 'Loading inventory...', percent: -1 } })
      const bulk: FDSNStationBulkItem[] = []
      for (let seedid of seedidList) {
        seedid = seedid.replace('.--.', '..')
        const [net, sta, loc, cha] = seedid.split('.')
        let found = false
        if (
          this.inventoryCache[net] != null
          && this.inventoryCache[net][sta] != null
          && this.inventoryCache[net][sta].location[loc] != null
          && this.inventoryCache[net][sta].location[loc][cha] != null
        ) {
          for (const info of this.inventoryCache[net][sta].location[loc][cha]) {
            if (t >= info.starttime && t <= info.endtime) {
              found = true
            }
          }
        }
        if (!found) {
          bulk.push([net, sta, loc, cha, t, t])
        }
      }
      if (bulk.length > 0) {
        this.client.baseURL = baseUrl
        this.client.getStationsBulk(bulk).then((inv) => {
          this.mergeInventory(inv as Inventory)
          notification({ type: 'progress', value: null })
          resolve(this.inventoryCache)
        })
      } else {
        resolve(this.inventoryCache)
      }
    })
  }

  getRadiusInventory(
    baseUrl: string,
    time: string,
    latitude: number,
    longitude: number,
    maxradius: number,
    network: string,
    station: string,
    location: string,
    channel: string
  ): Promise<Inventory> {
    return new Promise((resolve, reject) => {
      this.client.baseURL = baseUrl
      const params = {
        level: 'channel' as 'channel',
        format: 'text',
        latitude,
        longitude,
        minradius: 0,
        maxradius,
        starttime: time,
        endtime: time,
        network, station, location, channel
      }
      console.log(`[DataManager.getStationRadius] ${JSON.stringify(params)}`)
      this.client.getStations(params).then((inv) => {
        this.mergeInventory(inv as Inventory)
        resolve(this.inventoryCache)
      })
    })
  }

  getOriginStationInventory(
    baseUrl: string,
    time: number,
    latitude: number,
    longitude: number,
    arrivals: QArrival[],
    notification: (opt: WPNotificationOptions) => void
  ): Promise<Inventory> {
    return new Promise((resolve, reject) => {
      const seedidList: string[] = []
      for (const arrival of arrivals) {
        if (arrival.pickID.referredObject != null) {
          const [net, sta] = arrival.pickID.referredObject.waveformID.seedid.split('.').slice(0, 2)
          if (this.inventoryCache[net] == null || this.inventoryCache[net][sta] == null) {
            pushUnique(seedidList, `${net}.${sta}.*.*`)
          }
        }
      }
      if (seedidList.length > 0) {
        this.getInventory(baseUrl, seedidList, time, notification).then(response => {
          this.updateStationDistanceAzimuth(latitude, longitude)
          resolve(response as Inventory)
        })
      } else {
        resolve(this.inventoryCache)
      }
    })
  }

  _downloadDenoisedWaveforms(
    baseUrl: string,
    network: string,
    station: string,
    location: string,
    channel: string,
    starttime: string,
    endtime: string,
    signal: AbortSignal
  ): Promise<Trace[]> {
    return new Promise((resolve, reject) => {
      const cacheKey = `${starttime}-${endtime}`
      const args = Object.entries({ network, station, location, channel, starttime, endtime }).map(x => `${x[0]}=${x[1]}`).join('&')
      fetch(`${baseUrl}/api/denoiser?${args}`, {
        method: 'GET',
        signal
      }).then(response => {
        if (response.status === 200) {
          response.arrayBuffer().then(arr => {
            const st = new Stream(new DataView(arr))
            resolve(st.traces)
          })
        }
      })
    })
  }

  getDenoisedWaveforms(
    baseUrl: string,
    seedidList: string[],
    t1: Date,
    t2: Date,
    signal: AbortSignal
  ): Promise<Trace[]> {
    return new Promise((resolve, reject) => {
      const starttime = t1.toISOString().slice(0, 19)
      const endtime = t2.toISOString().slice(0, 19)
      const cacheKey = `${starttime}-${endtime}`
      const dlStatus: Record<string, boolean> = {}
      const result: Trace[] = []
      for (const seedid of seedidList) {
        const baseId = seedid.slice(0, -1)
        const traceCacheKey = `denoised_${baseId}`
        const compCacheKey = `${seedid.slice(-1)[0]}_${cacheKey}`
        const cached = this.getWaveformCache(traceCacheKey, compCacheKey)
        if (cached != null) {
          result.push(cached)
        } else {
          dlStatus[baseId] = false
        }
      }
      if (Object.keys(dlStatus).length > 0) {
        for (const baseId of Object.keys(dlStatus)) {
          const [net, sta, loc, cha] = baseId.replace('..', '.--.').split('.')
          this._downloadDenoisedWaveforms(baseUrl, net, sta, loc, cha, starttime, endtime, signal).then((data: Trace[]) => {
            for (const tr of data) {
              const baseId = tr.stats.id.slice(0, -1)
              dlStatus[baseId] = true
              this.setWaveformCache(`denoised_${baseId}`, `${tr.stats.id.slice(-1)[0]}_${cacheKey}`, tr)
              result.push(tr)
            }
            const remaining = Object.values(dlStatus).filter(x => x === false)
            if (remaining.length === 0) {
              resolve(result)
            }
          })
        }
      } else {
        resolve(result)
      }
    })
  }

  getStationPos(netsta: string) {
    const [net, sta] = netsta.split('.')
    if (this.inventoryCache[net] != null && this.inventoryCache[net][sta] != null) {
      return {
        lat: this.inventoryCache[net][sta].lat,
        lon: this.inventoryCache[net][sta].lon,
        alt: this.inventoryCache[net][sta].alt
      }
    }
    console.warn(`Can't find pos of station ${net}.${sta}`)
    return null
  }

  loadTTT(
    baseUrl: string,
    latitude: number,
    longitude: number,
    depth: number,
    netstaList: string[],
    notification: (opt: WPNotificationOptions) => void
  ): Promise<null> {
    return new Promise((resolve, reject) => {
      notification({ type: 'progress', value: { text: 'Loading theoretical travel times...', percent: -1 } })
      const stationQuery: Record<string, [number, number, number]> = {}
      const query = {
        latitude: latitude,
        longitude: longitude,
        depth: depth / 1e3,
        station: stationQuery
      }
      for (const netsta of netstaList) {
        if (this.tttCache[netsta] == null) {
          const pos = this.getStationPos(netsta)
          if (pos != null) {
            stationQuery[netsta] = [pos.lat, pos.lon, pos.alt]
          }
        }
      }
      if (Object.keys(stationQuery).length > 0) {
        console.log(`[DataManager.loadTTT] ${JSON.stringify(query)}`)
        fetch(`${baseUrl}/api/ttt`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(query)
        }).then(response => {
          response.json().then(ttt => {
            this.tttCache = { ...this.tttCache, ...ttt }
            notification({ type: 'progress', value: null })
            resolve(null)
          })
        })
      } else {
        notification({ type: 'progress', value: null })
        resolve(null)
      }
    })
  }

  getStationPhaseTime(t0: number, netsta: string, phase: 'P' | 'S'): number {
    if (this.tttCache[netsta] != null && this.tttCache[netsta].ttt[phase] != null) {
      return t0 + this.tttCache[netsta].ttt[phase] * 1e3
    }
    return t0
  }

  getNLLStationPhaseTime(t0: number, netsta: string, phase: 'P' | 'S'): number | null {
    if (this.tttCache[netsta] != null && this.tttCache[netsta].nll_ttt != null) {
      return t0 + this.tttCache[netsta].nll_ttt![phase] * 1e3
    }
    return null
  }

  _getChannels(net: string, sta: string, loc: string, chaPrefix: string): string[] {
    const inv = this.inventoryCache
    const result: string[] = []
    if (inv[net] != null && inv[net][sta] != null && inv[net][sta].location[loc] != null) {
      for (const cha of Object.keys(this.inventoryCache[net][sta].location[loc])) {
        if (cha.indexOf(chaPrefix) === 0 || cha === 'HDH') {
          result.push(`${net}.${sta}.${loc}.${cha}`)
        }
      }
    }
    return result
  }

  getStationChannels(net: string, sta: string): string[] {
    const inv = this.inventoryCache
    const result: string[] = []
    if (inv[net] != null && inv[net][sta] != null) {
      for (const loc of Object.keys(this.inventoryCache[net][sta].location)) {
        for (const cha of Object.keys(this.inventoryCache[net][sta].location[loc])) {
          result.push(`${net}.${sta}.${loc}.${cha}`)
        }
      }
    }
    return result
  }

  getDetectionKey( netsta: string, model: string, dataset: string, pThresh: number, sThresh: number) {
    return `${netsta}-${model}-${dataset}-${pThresh}-${sThresh}`
  }

  getDetection(
    baseUrl: string,
    model: string,
    dataset: string,
    wfid: string,
    start: string,
    end: string,
    pThresh: number,
    sThresh: number,
    signal: AbortSignal
  ): Promise<Detection[]> {
    return new Promise((resolve, reject) => {
      const netsta = toNetSta(wfid)
      const key = this.getDetectionKey(netsta, model, dataset, pThresh, sThresh)
      if (this.detectorCache[key] != null) {
        resolve(this.detectorCache[key])
      } else {
        const args = Object.entries({ model, wfid, start, end, p_thresh: pThresh, s_thresh: sThresh, dataset }).map(x => `${x[0]}=${x[1]}`).join('&')
        fetch(`${baseUrl}/api/detector?${args}`, { method: 'GET', signal }).then(response => {
          if (response.status === 200) {
            response.json().then((data: DetectionResult[]) => {
              this.detectorCache[key] = []
              for (const d of data) {
                this.detectorCache[key].push({
                  time: Date.parse(`${d.phase_time.slice(0, 23)}000Z`),
                  phase: `${d.phase_type} (${d.phase_score})`
                })
              }
              resolve(this.detectorCache[key])
            })
          }
        })
      }
    })
  }

  _downloadChunk(
    bulk: FDSNWaveformBulkItem[],
    index: number,
    cacheKey: string,
    signal: AbortSignal,
    callback: (data: Trace[]) => void,
    notification: (opt: WPNotificationOptions) => void
  ) {
    const chunk = bulk.slice(index, index + CHUNK_LENGTH)
    index += CHUNK_LENGTH
    if (chunk.length === 0) {
      notification({ type: 'progress', value: null })
      const missing: string[] = []
      for (const item of bulk) {
        const fdsnid = item.slice(0, 4).join('.')
        if (this.waveformCache[fdsnid] == null) {
          missing.push(fdsnid)
        }
      }
      if (missing.length > 0) {
        notification({ type: 'warning', value: `These channels could not be retrieved:\n${missing.join('\n')}` })
      }
      return
    }
    notification({ type: 'progress', value: { percent: Math.min(100 * index / (bulk.length - 1), 100), text: 'Downloading...' } })
    this.client.getWaveformsBulk(chunk, () => null, signal).then((response) => {
      const st = response as Stream
      const result: Trace[] = []
      for (const tr of st.traces) {
        const fdsnid = tr.stats.id.replace('..', '.--.')
        this.setWaveformCache(fdsnid, cacheKey, tr)
        result.push(tr)
      }
      callback(result)
      this._downloadChunk(bulk, index, cacheKey, signal, callback, notification)
    }).catch(err => console.warn(err))
  }

  getWaveforms(
    baseUrl: string,
    seedidList: string[],
    t1: Date, t2: Date,
    signal: AbortSignal,
    callback: (data: Trace[]) => void,
    notification: (opt: WPNotificationOptions) => void
  ) {
    console.log(`[DataManager.getWaveforms] ${t1.toISOString()} - ${t2.toISOString()} | ${JSON.stringify(seedidList)}`)
    const bulk: FDSNWaveformBulkItem[] = []
    const result: Trace[] = []
    const cacheKey = `${t1.toISOString().slice(0, 19)}-${t2.toISOString().slice(0, 19)}`
    for (const seedid of seedidList) {
      const fdsnid = seedid.replace('..', '.--.')
      const [net, sta, loc, cha] = fdsnid.split('.')
      const cached = this.getWaveformCache(fdsnid, cacheKey)
      if (cached != null) {
        result.push(cached)
      } else {
        bulk.push([net, sta, loc, cha, t1, t2])
      }
    }
    if (bulk.length > 0) {
      this.client.baseURL = baseUrl
      this._downloadChunk(bulk, 0, cacheKey, signal, callback, notification)
    }
    if (result.length > 0) {
      callback(result)
    }
  }

  getData(
    baseUrl: string,
    time: number,
    latitude: number,
    longitude: number,
    depth: number,
    seedidList: string[],
    maxTrace: number | null,
    timewindow: [number, number],
    noEvent: boolean,
    signal: AbortSignal,
    callback: (data: Trace[]) => void,
    notification: (opt: WPNotificationOptions) => void
  ) {
    const netstaList: string[] = []
    for (const seedid of seedidList) {
      pushUnique(netstaList, toNetSta(seedid))
    }
    this.getInventory(baseUrl, seedidList, time, notification).then(() => {
      if (noEvent) {
        const t1 = new Date(time - timewindow[0] * 1e3)
        const t2 = new Date(time + timewindow[1] * 1e3)
        let reqSeedidList: string[] = []
        for (const seedid of seedidList) {
          const [net, sta, loc, chaPrefix] = seedid.slice(0, -1).split('.')
          for (const seedid of this._getChannels(net, sta, loc, chaPrefix)) {
            pushUnique(reqSeedidList, seedid)
          }
        }
        if (maxTrace != null && reqSeedidList.length > maxTrace) {
          notification({ type: 'warning', value: `Max number of channels reached: ${maxTrace} will be downloaded instead of ${reqSeedidList.length}` })
          reqSeedidList = reqSeedidList.slice(0, maxTrace)
        }
        this.getWaveforms(baseUrl, reqSeedidList, t1, t2, signal, callback, notification)
      } else {
        this.loadTTT(baseUrl, latitude, longitude, depth, netstaList, notification).then(() => {
          const t1 = new Date(time - timewindow[0] * 1e3)
          let maxTime = time + 120e3
          for (const netstaTTT of Object.values(this.tttCache)) {
            for (const ttt of Object.values(netstaTTT.ttt)) {
              maxTime = Math.max(maxTime, time + ttt * 1e3)
            }
          }
          const t2 = new Date(maxTime + timewindow[1] * 1e3)
          let reqSeedidList: string[] = []
          for (const seedid of seedidList) {
            const [net, sta, loc, chaPrefix] = seedid.slice(0, -1).split('.')
            for (const seedid of this._getChannels(net, sta, loc, chaPrefix)) {
              pushUnique(reqSeedidList, seedid)
            }
          }
          if (maxTrace != null && reqSeedidList.length > maxTrace) {
            notification({ type: 'warning', value: `Max number of channels reached: ${maxTrace} will be downloaded instead of ${reqSeedidList.length}` })
            reqSeedidList = reqSeedidList.slice(0, maxTrace)
          }
          this.getWaveforms(baseUrl, reqSeedidList, t1, t2, signal, callback, notification)
        })
      }
    })
  }
}