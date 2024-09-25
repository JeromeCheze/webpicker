import type { QPick } from '@/lib/sismojs/src/core/event/types'
import type Lichen from '@/lib/lichen/src'

export interface WPNotificationOptions {
  type: 'progress' | 'info' | 'warning'
  value: any
}

export interface Activity {
  author: string
  state: string
  event: string
}

export interface CommitOptions {
  eventType: string
  eventTypeCertainty: string
  evaluationStatus: string
}

export type ComputeMagnitudesOptions = string[]

export interface ColObject {
  label: string
  valueAccessor: (item: any) => any
  textAccessor: (item: any) => string
  class?: (item: any) => string
  icon?: string
  enabled: boolean
}

export interface WebpickerForm {
  start: string
  end: string
  minlat: number
  maxlat: number
  minlon: number
  maxlon: number
  mindepth: number
  maxdepth: number
  minmag: number | null
  maxmag: number | null
}

export interface EventViewStatus {
  relocateStatus: 'enabled' | 'required'
  computeMagnitudesStatus: 'enabled' | 'disabled' | 'required'
  commitStatus: 'enabled' | 'disabled' | 'required'
}

export interface PickerToolbarOptions {
  phase: 'P' | 'S' | undefined
  alignment: 'O' | 'P' | 'S'
  components: string[]
  seedids: string[]
  sort: 'distance' | 'name'
  rotation: 'ZNE' | 'ZRT'
  filter: string | null
  denoiser: boolean
  spectrogram: boolean
  detector: boolean
  commonScale: boolean
  integration: boolean
  tttEnabled: boolean
}

export interface FilterOptions {
  name: string
  expression: string
}

export interface FiliFilterOptions {
  Fs: number
  order: number
  gain: number
  preGain: boolean
  characteristic: string
  Fc?: number
  BW?: number
}

// export interface WaveformData {
//   name: string
//   serie: LineOptions
//   vlines: VLine[]
//   chart?: Lichen
// }

export interface WaveformProcessInterface {
  id: string
  start: number
  step: number
  values: (number | null)[]
  spectrogram?: {
    values: number[][]
    yMin: number
    yMax: number
    zMin: number
    zMax: number
  }
}

export interface ChartData {
  index: number
  container: HTMLElement
  chart: Lichen
  spectrogram?: WaveformProcessInterface['spectrogram']
}

export interface TTT {
  [netsta: string]: {
    ttt: {
      P: number
      S: number
    },
    nll_ttt?: {
      P: number
      S: number
    }
  }
}

export interface Detection {
  time: number
  phase: string
}

export interface DetectionResult {
  station_id: string
  phase_time: string
  phase_score: number
  starttime: string
  endtime: string
  phase_type: string
  filter: string
}

export interface PickMap {
  [netsta: string]: {
    [seedid: string]: QPick[]
  }
}

export interface StationRefTimes {
  [netsta: string]: {
    [phase: string]: number
  }
}