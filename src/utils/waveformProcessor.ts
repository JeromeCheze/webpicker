import type { WaveformProcessInterface, FilterOptions, FiliFilterOptions } from '@/types'
import type { Trace } from '@/lib/sismojs/src/core/waveform'
import type DataManager from '@/utils/dataManager'
import { parseFilter } from '.'
import Fili from 'fili'

abstract class BaseProcessor {

  enabled: boolean
  cache: WaveformProcessInterface[]
  dirty: boolean

  constructor() {
    this.enabled = false
    this.cache = []
    this.dirty = true
  }

  setEnable(value: boolean) {
    this.enabled = value
    return this
  }

  abstract task(data: WaveformProcessInterface[]): Promise<WaveformProcessInterface[]>

  process(data: WaveformProcessInterface[]): Promise<WaveformProcessInterface[]> {
    if (this.enabled) {
      if (!this.dirty) {
        const cacheIds = this.cache.map(x => x.id)
        for (const currData of data) {
          if (cacheIds.indexOf(currData.id) < 0) {
            this.dirty = true
            break
          }
        }
      }
      if (this.dirty) {
        return this.task(data)
      }
      return new Promise((resolve, reject) => {
        resolve(this.cache)
      })
    }
    return new Promise((resolve, reject) => {
      resolve(data)
    })
  }
}

export class IntegrationProcessor extends BaseProcessor {
  task(data: WaveformProcessInterface[]): Promise<WaveformProcessInterface[]> {
    return new Promise((resolve, reject) => {
      const result: WaveformProcessInterface[] = []
      for (const currData of data) {
        const step = currData.step / 1e3 // convert the step from [ms] to [s]
        // compute the average value
        let sum = 0
        let count = 0
        for (const sample of currData.values) {
          if (sample != null) {
            sum += sample
            count++
          }
        }
        const avg = sum / count
        // integrate
        // the method used is cumulative trapezoid
        const values = []
        let prev = 0
        for (let i = 1; i < currData.values.length; i++) {
          const sPrev = currData.values[i - 1]
          const s = currData.values[i]
          if (sPrev == null || s == null) {
            values.push(null)
            continue
          }
          // the average value is removed from the samples
          const v = prev + step * ((sPrev - avg) + (s - avg) / 2)
          prev = parseFloat(v.toPrecision(14))
          values.push(prev)
        }
        result.push({ id: currData.id, start: currData.start, step: currData.step, values })
      }
      resolve(result)
    })
  }
}

export class SpectrogramProcessor extends BaseProcessor {
  task(data: WaveformProcessInterface[]): Promise<WaveformProcessInterface[]> {
    const FFTSize = 128
    const dataStep = 50
    return new Promise((resolve, reject) => {
      const result = data.map(x => x)
      for (const currData of data) {
        const fft = new Fili.Fft(FFTSize)
        const nbFreqBin = FFTSize / 2
        const samplingRate = 1e3 / currData.step
        const values: number[][] = []
        let zMin: number | null = null
        let zMax: number | null = null
        for (let i = 0; i < currData.values.length; i += dataStep) {
          const chunk = currData.values.slice(i, i + FFTSize)
          if (chunk.length < FFTSize) {
            break
          }
          const db = fft.magToDb(fft.magnitude(fft.forward(chunk, 'hanning')))
          const chunkFft: number[] = []
          values.push(chunkFft)
          for (let j = 1; j < nbFreqBin; j++) {
            chunkFft.push(db[j])
            zMin = zMin == null ? db[j] : Math.min(zMin, db[j])
            zMax = zMax == null ? db[j] : Math.max(zMax, db[j])
          }
        }
        result.push({
          id: `spectro ${currData.id}`,
          start: currData.start + nbFreqBin * currData.step,
          step: dataStep * currData.step,
          values: [],
          spectrogram: {
            values,
            yMin: samplingRate / FFTSize,
            yMax: (nbFreqBin - 1) * samplingRate / FFTSize,
            zMin: zMin as number,
            zMax: zMax as number
          }
        })
      }
      resolve(result)
    })
  }
}

export class DenoiseProcessor extends BaseProcessor {
  dataManager: DataManager
  signal: AbortSignal
  constructor(dataManager: DataManager, signal: AbortSignal) {
    super()
    this.dataManager = dataManager
    this.signal = signal
  }
  task(data: WaveformProcessInterface[]): Promise<WaveformProcessInterface[]> {
    return new Promise((resolve, reject) => {
      const seedidList = data.map(x => x.id)
      const t1 = new Date(Math.min.apply(null, data.map(x => x.start)))
      const t2 = new Date(Math.max.apply(null, data.map(x => x.start + x.step * x.values.length)))
      this.dataManager.getDenoisedWaveforms('..', seedidList, t1, t2, this.signal).then((result: Trace[]) => {
        resolve(result.map(tr => ({
          id: tr.stats.id,
          start: tr.stats.starttime as number,
          step: 1e3 / tr.stats.samplingRate,
          values: tr.data
        })))
      })
    })
  }
}

export class RotateProcessor extends BaseProcessor {
  azimuth: number | null
  constructor() {
    super()
    this.azimuth = null
  }
  setAzimuth(value: number | null) {
    this.azimuth = value
    return this
  }
  task(data: WaveformProcessInterface[]): Promise<WaveformProcessInterface[]> {
    return new Promise((resolve, reject) => {
      if (this.azimuth == null) {
        throw new Error(`No azimuth value set`)
      }
      const componentGroup: {
        [baseId: string]: {
          n: WaveformProcessInterface | null
          e: WaveformProcessInterface | null
        } 
      } = {}
      for (const currData of data) {
        const baseId = currData.id.slice(0, -1)
        if (componentGroup[baseId] == null) {
          componentGroup[baseId] = { n: null, e: null }
        }
        if (currData.id.slice(-1)[0] === 'N') {
          componentGroup[baseId].n = currData
        } else if (currData.id.slice(-1)[0] === 'E') {
          componentGroup[baseId].e = currData
        }
      }
      const result: WaveformProcessInterface[] = []
      const baz = (this.azimuth + 180) % 360
      for (const [baseId, h] of Object.entries(componentGroup)) {
        for (const currData of data.filter(x => x.id.indexOf(baseId) === 0 && ['N', 'E'].indexOf(x.id.slice(-1)[0]) < 0)) {
          // push unprocessed data of the current baseId and not horizontal component
          result.push(currData)
        }
        if (h.n == null || h.e == null) {
          continue
        }
        const start = Math.max(h.n.start, h.e.start)
        const end = Math.min(
          h.n.start + h.n.step * h.n.values.length,
          h.e.start + h.e.step * h.e.values.length
        )
        const iN = Math.floor((start - h.n.start) / h.n.step)
        const iE = Math.floor((start - h.e.start) / h.e.step)
        const nbSamples = Math.floor((end - start) / h.n.step)
        const rData: WaveformProcessInterface = { id: `${baseId}R`, start, step: h.n.step, values: [] }
        const tData: WaveformProcessInterface = { id: `${baseId}T`, start, step: h.e.step, values: [] }
        for (let i = 0; i < nbSamples; i++) {
          const [n, e] = [h.n.values[iN + i], h.e.values[iE + i]]
          if (n == null || e == null) {
            rData.values.push(null)
            tData.values.push(null)
            continue
          }
          rData.values.push(-e * Math.sin(baz) - n * Math.cos(baz))
          tData.values.push(-e * Math.cos(baz) + n * Math.sin(baz))
        }
        result.push(rData)
        result.push(tData)
      }
      resolve(result)
    })
  }
}

export class FilterProcessor extends BaseProcessor {

  params: FilterOptions | null

  constructor() {
    super()
    this.params = null
  }

  setFilterParams(params: FilterOptions | null) {
    this.params = params
    this.dirty = true
    return this
  }

  task(data: WaveformProcessInterface[]): Promise<WaveformProcessInterface[]> {
    return new Promise((resolve, reject) => {
      if (this.params == null) {
        throw new Error(`No filter parameters set`)
      }
      const filterDef = parseFilter(this.params.expression)
      if (filterDef == null) {
        throw new Error(`Could not parse filter expression ${this.params}`)
      }
      const result: WaveformProcessInterface[] = []
      for (const currData of data) {
        const filterOpt: FiliFilterOptions = {
          Fs: 1e3 / currData.step,
          order: filterDef.order,
          gain: 0,
          preGain: false,
          characteristic: 'butterworth'
        }
        if (filterDef.type === 'bandpass') {
          filterOpt.Fc = Math.sqrt(filterDef.fc[1] * filterDef.fc[0])
          filterOpt.BW = Math.log2(filterDef.fc[1] / filterDef.fc[0])
        } else {
          filterOpt.Fc = filterDef.fc[0] as number
        }
        const iirCalculator = new Fili.CalcCascades()
        const iirFilterCoeffs = iirCalculator[filterDef.type](filterOpt)
        const iirFilter = new Fili.IirFilter(iirFilterCoeffs)
        const values = iirFilter.simulate(currData.values)
        const taperLength = 4 * filterOpt.Fs
        for (let i = 0; i < taperLength; i++) {
          values[i] = values[i] != null
            ? values[i]! * Math.pow(i / taperLength, 3)
            : null
        }
        result.push({ id: currData.id, start: currData.start, step: currData.step, values })
      }
      resolve(result)
    })
  }
}