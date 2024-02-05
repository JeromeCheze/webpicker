import type Lichen from '@/lib/lichen/src'
import type { LineOptions, VLine } from '@/lib/lichen/src/types'
import type { Pick } from '@/lib/sismojs/src/types'

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
  alignment: string
  component: string
  components: string[]
  sort: 'distance' | 'name'
  rotation: 'ZNE' | 'ZRT'
  filters: string[]
  filter: string | null
}

export interface FilterOptions {
  name: string
  type: 'highpass' | 'lowpass' | 'bandpass'
  fc: number | [number, number]
  order: number
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

export interface WaveformData {
  name: string
  serie: LineOptions
  vlines: VLine[]
  chart?: Lichen
}

export interface ChartData {
  index: number
  container: HTMLElement
  chart: Lichen
}

export interface TTT {
  [netsta: string]: {
    ttt: {
      P: number
      S: number
    }
  }
}

export interface PickMap {
  [netsta: string]: {
    [seedid: string]: Pick[]
  }
}

export interface StationRefTimes {
  [netsta: string]: {
    [key: string]: number
  }
}