import type { QPick } from '@/lib/sismojs/src/core/event/types'
import type Lichen from '@/lib/lichen/src'

export interface WPNotificationOptions {
  type: 'progress' | 'info' | 'warning' | 'error'
  value: any
}


export interface ChatData {
  id: string
  time: string
  expeditor: string
  recipient: string
  broadcast: boolean
  message: string
}

export interface ActivityData {
  id: string
  author: string
  state: string
  event: string
}

export interface WebSocketMessage {
  type: 'activity' | 'chat'
  data: ActivityData | ChatData
}

export interface WebSocketResponse {
  type: 'activity' | 'chat' | 'version'
  data: ActivityData[] | ChatData | string
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
  img?: (item: any) => string
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
  relocate: 'enabled' | 'required'
  computeMagnitudes: 'enabled' | 'disabled' | 'required'
  commit: 'enabled' | 'disabled' | 'required'
}

export interface PickerToolbarOptions {
  phase: 'P' | 'S' | undefined
  alignment: 'O' | 'P' | 'S'
  components: string[]
  seedids: string[]
  sort: 'distance' | 'name-asc' | 'name-desc'
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

export interface Config {
  access: {
    restricted: boolean
    users: {
      [username: string]: {
        password: string
        rules: {
          [key: string]: any
        }
      }
    }
  }
  agency: string
  detector: {
    enabled: boolean
    url: string
  }
  denoiser: {
    enabled: boolean
    url: string
  }
  nll: {
    enabled: boolean
    url: string
    area: string
  }
  skhash: {
    enabled: boolean
    python_interpreter: string
    path: string
  }
  fdsnws: {
    event_host: string
    station_host: string
    dataselect_host: string
  }
  commit_strategy: 'script' | 'scdispatch'
  commit_script: string
  seiscomp: {
    messaging_host: string
    root: string
    schema_version: string
  }
  title: string
}