import { State } from '@/types'
import settings from '@/settings'

const end = new Date(new Date().getTime() + 86400e3)
const start = new Date(end.getTime() - 86400e3 * 8)

const state: State = {

  root: location.href.split('#')[0],

  author: null,
  authorDialog: false,
  agencyId: 'OCA',

  defaultSettings: settings,
  settings: Object.assign({}, settings),

  loading: false,
  loadingMsg: '',

  notificationList: [],

  authorStatus: {},
  alertEventLocked: null,
  alertEventLockedDialog: false,
  acknowledgedMsgIds: [],

  eventList: [],
  eventListDirty: true,

  currentEvent: null,
  currentOrigin: null,
  currentFocalMechanism: null,
  inventory: {},

  traceCache: {},
  tttCache: {},
  phasenetCache: {},
  phasenetProbabilityCache: {},
  pickerLastOrigin: null,

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
  },

  log: []

}

export default state
