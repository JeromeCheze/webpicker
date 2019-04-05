import settings from '@/settings'

export default {

  root: '/',

  defaultSettings: settings,
  settings,

  loading: false,
  loadingMsg: '',

  eventList: [],

  currentEvent: null,
  currentOrigin: null,
  inventory: {},

  form: {
    starttime: null,
    endtime: null,
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
