import settings from '@/settings'

let end = new Date(new Date().getTime() + 86400e3)
let start = new Date(end.getTime() - 86400e3 * 8)

export default {

  root: '/',

  defaultSettings: settings,
  settings: Object.assign({}, settings),

  loading: false,
  loadingMsg: '',

  eventList: [],

  currentEvent: null,
  currentOrigin: null,
  inventory: {},

  waveformCache: {},

  form: {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    minlat: -90,
    maxlat: 90,
    minlon: -180,
    maxlon: 180,
    mindepth: 0,
    maxdepth: 750,
    minmag: null,
    maxmag: null
  }

}
