import type { Stream, Trace } from "@/lib/sismojs/src/core/waveform"
import { Client } from "@/lib/sismojs/src/fdsn"
import type { FDSNStationBulkItem, FDSNWaveformBulkItem, Inventory, Origin, WaveformId, Pick } from "@/lib/sismojs/src/types"
import type { FiliFilterOptions, FilterOptions, TTT } from "@/types"
import Fili from 'fili'

const CHUNK_LENGTH = 12

export const shortcutString = (ev: KeyboardEvent) => {
  const k = []
  const keyCode = ev.keyCode || ev.which || ev.charCode || ev.key.charCodeAt(0)
  if (ev.metaKey) k.push('meta')
  if (ev.ctrlKey) k.push('ctrl')
  if (ev.altKey) k.push('alt')
  if (ev.shiftKey) k.push('shift')
  if (keyCode === 32) {
    k.push('space')
  } else if (keyCode >= 48 && keyCode <= 126) {
    k.push(String.fromCharCode(keyCode))
  } else {
    k.push(ev.key)
  }
  let kStr = k.join('+').toLowerCase()
  if (kStr.indexOf('arrow') >= 0) {
    ev.preventDefault()
    kStr = kStr.replace('arrow', '')
  }
  return kStr
}

export function cloneAndClean(obj: any) {
  const result: {[index: string]: any} = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k.indexOf('_') === 0) {
      continue
    }
    if (v instanceof Array) {
      result[k] = v.map(x => cloneAndClean(v))
    } else if (v instanceof Object) {
      result[k] = cloneAndClean(v)
    } else {
      result[k] = v
    }
  }
  return result
}

export function getDefault(obj: Record<string, any>, key: string, value: any) {
  if (obj[key] == null) {
    obj[key] = value
  }
  return obj[key]
}

export function getId(prefix: string) {
  const now = new Date().toISOString()
  return prefix === 'Event'
    ? now.replace(/[-:]/g, '').replace(/[T.]/g, '_').slice(0, 19)
    : [
        prefix,
        now.replace(/[-:]/g, '').replace('T', '.').slice(0, 18),
        (Math.random() * 1000).toFixed(0)
      ].join('-')
}

export function toNetSta(seedid: string) {
  return seedid.split('.').slice(0, 2).join('.')
}

export function applyFilter(f: FilterOptions, fs: number, values: (number | null)[]) {
  if (f != null) {
    const filterOpt: FiliFilterOptions = {
      Fs: fs,
      order: f.order,
      gain: 0,
      preGain: false,
      characteristic: 'butterworth'
    }
    if (f.type === 'bandpass' && f.fc instanceof Array) {
      filterOpt.Fc = Math.sqrt(f.fc[1] * f.fc[0])
      filterOpt.BW = Math.log2(f.fc[1] / f.fc[0])
    } else {
      filterOpt.Fc = f.fc as number
    }
    const iirCalculator = new Fili.CalcCascades()
    const iirFilterCoeffs = iirCalculator[f.type](filterOpt)
    const iirFilter = new Fili.IirFilter(iirFilterCoeffs)
    values = iirFilter.simulate(values)
    const taperLength = 4 * fs
    for (let i = 0; i < taperLength; i++) {
      values[i] = values[i] != null ? values[i]! * Math.pow(i / taperLength, 3) : null
    }
  }
  return values
}


export class DataManager {

  client: Client
  inventoryCache: Inventory
  waveformCache: { [fdsnid: string]: { [timewindow: string]: Trace } }
  tttCache: TTT

  constructor(baseUrl: string) {
    this.client = new Client(baseUrl)
    this.inventoryCache = {}
    this.waveformCache = {}
    this.tttCache = {}
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

  getInventory(baseUrl: string, seedidList: string[], t: Date) {
    return new Promise((resolve, reject) => {
      const bulk: FDSNStationBulkItem[] = []
      for (let seedid of seedidList) {
        seedid = seedid.replace('..', '.--.')
        const [net, sta, loc, cha] = seedid.split('.')
        let found = false
        if (
          this.inventoryCache[net] != null
          && this.inventoryCache[net][sta] != null
          && this.inventoryCache[net][sta].location[loc] != null
          && this.inventoryCache[net][sta].location[loc][cha] != null
          && this.inventoryCache[net][sta].location[loc][cha]
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
          resolve(this.inventoryCache)
        })
      } else {
        resolve(this.inventoryCache)
      }
    })
  }

  getOriginStationInventory(baseUrl: string, origin: Origin) {
    return new Promise((resolve, reject) => {
      if (origin.arrival != null) {
        const seedidList: string[] = []
        for (const arrival of origin.arrival) {
          if (arrival._pick != null) {
            const [net, sta] = arrival._pick._seedid.split('.').slice(0, 2)
            const seedid = `${net}.${sta}.*.*`
            if (seedidList.indexOf(seedid) < 0) {
              seedidList.push(seedid)
            }
          }
        }
        if (seedidList.length > 0) {
          this.getInventory(baseUrl, seedidList, origin.time._value!).then(response => {
            resolve(response as Inventory)
          })
        } else {
          resolve(this.inventoryCache)
        }
      } else {
        reject()
      }
    })
  }

  _downloadChunk(bulk: FDSNWaveformBulkItem[], cacheKey: string, signal: AbortSignal, callback: (data: Trace[]) => void) {
    const chunk = bulk.splice(0, CHUNK_LENGTH)
    if (chunk.length === 0) {
      return
    }
    this.client.getWaveformsBulk(chunk, () => null, signal).then((response) => {
      const st = response as Stream
      const result: Trace[] = []
      for (const tr of st.traces) {
        const fdsnid = tr.stats.id.replace('..', '.--.')
        if (this.waveformCache[fdsnid] == null) {
          this.waveformCache[fdsnid] = {}
        }
        this.waveformCache[fdsnid][cacheKey] = tr
        result.push(tr)
      }
      callback(result)
      this._downloadChunk(bulk, cacheKey, signal, callback)
    }).catch(err => console.warn(err))
  }

  getWaveforms(baseUrl: string, seedidList: string[], t1: Date, t2: Date, signal: AbortSignal, callback: (data: Trace[]) => void) {
    const cacheKeyMap: Record<string, string> = {}
    const bulk: FDSNWaveformBulkItem[] = []
    const result: Trace[] = []
    const timewindow = t1 instanceof Date && t2 instanceof Date
      ? `${t1.toISOString().slice(0, 19)}-${t2.toISOString().slice(0, 19)}`
      : `${t1}-${t2}`
    for (const seedid of seedidList) {
      const fdsnid = seedid.replace('..', '.--.')
      const [net, sta, loc, cha] = fdsnid.split('.')
      if (this.waveformCache[fdsnid] != null && this.waveformCache[fdsnid][timewindow] != null) {
        result.push(this.waveformCache[fdsnid][timewindow])
      } else {
        bulk.push([net, sta, loc, cha, t1, t2])
        cacheKeyMap[fdsnid] = timewindow
      }
    }
    if (bulk.length > 0) {
      this.client.baseURL = baseUrl
      this._downloadChunk(bulk, timewindow, signal, callback)
    } else {
      callback(result)
    }
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

  loadTTT(baseUrl: string, origin: Origin, netstaList: string[]) {
    return new Promise((resolve, reject) => {
      const stationQuery: Record<string, [number, number, number]> = {}
      const query = {
        latitude: origin.latitude.value,
        longitude: origin.longitude.value,
        depth: origin.depth.value / 1e3,
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
        fetch(`${baseUrl}/api/ttt`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(query)
        }).then(response => {
          response.json().then(ttt => {
            this.tttCache = { ...this.tttCache, ...ttt }
            resolve(null)
          })
        })
      } else {
        resolve(null)
      }
    })
  }

  getStationPhaseTime(netsta: string, phase: 'P' | 'S') {
    if (this.tttCache[netsta] != null && this.tttCache[netsta].ttt[phase] != null) {
      return this.tttCache[netsta].ttt[phase]
    }
    return 0
  }

  getOriginData(baseUrl: string, origin: Origin, signal: AbortSignal, callback: (data: Trace[]) => void) {
    if (origin.arrival == null) {
      return
    } else {
      const inv = this.inventoryCache
      const netstaList: string[] = []
      const pickList: Pick[] = []
      for (const arrival of origin.arrival) {
        if (arrival._pick != null) {
          pickList.push(arrival._pick)
        }
      }
      pickList.sort((a, b) => {
        const aa = a.time._value!
        const bb = b.time._value!
        return aa < bb ? -1 : aa > bb ? 1 : 0
      })
      const seedidList: string[] = []
      for (const pick of pickList) {
        const [net, sta, loc, chaPrefix] = pick._seedid.slice(0, -1).split('.')
        const netsta = `${net}.${sta}`
        if (netstaList.indexOf(netsta) < 0) {
          netstaList.push(netsta)
        }
        if (inv[net] != null && inv[net][sta] != null && inv[net][sta].location[loc] != null) {
          for (const cha of Object.keys(this.inventoryCache[net][sta].location[loc])) {
            if (cha.indexOf(chaPrefix) === 0) {
              const seedid = `${net}.${sta}.${loc}.${cha}`
              if (seedidList.indexOf(seedid) < 0) {
                seedidList.push(seedid)
              }
            }
          }
        }
      }
      this.loadTTT(baseUrl, origin, netstaList).then(() => {
        const t0 = origin.time._value!.getTime()
        const t1 = new Date(t0 - 15e3)
        let maxTime = t0 + 30e3
        for (const netstaTTT of Object.values(this.tttCache)) {
          for (const ttt of Object.values(netstaTTT.ttt)) {
            maxTime = Math.max(maxTime, t0 + ttt * 1e3)
          }
        }
        const t2 = new Date(maxTime + 15e3)
        this.getWaveforms(baseUrl, seedidList, t1, t2, signal, callback)
      })
    }
  }
}