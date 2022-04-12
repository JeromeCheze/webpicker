import Highcharts from 'highcharts'

export type WebpickerForm = {
  start: string;
  end: string;
  minlat: number;
  maxlat: number;
  minlon: number;
  maxlon: number;
  mindepth: number;
  maxdepth: number;
  minmag: number | null;
  maxmag: number | null;
}

export type WebpickerSettings = Record<string, boolean | string | number | Record<string, string, number, number[]>>

export type State = {
  root: string;

  author: string | null;
  authorDialog: boolean;
  agencyId: string;

  defaultSettings: WebpickerSettings;
  settings: WebpickerSettings;

  loading: boolean;
  loadingMsg: string;

  notificationList: [];

  authorStatus: {};
  alertEventLocked: string | null;
  alertEventLockedDialog: boolean;
  acknowledgedMsgIds: string[];

  eventList: [];
  eventListDirty: boolean;

  currentEvent: string | null;
  currentOrigin: null;
  currentFocalMechanism: null;
  inventory: {};

  traceCache: {};
  tttCache: {};
  pickerLastOrigin: null;

  form: WebpickerForm;

  log: string[];
}

export type WebpickerCreationInfo = {
  author: string;
}

export type WebpickerRealQuantity = {
  _pretty: string;
}

export type WebpickerQuality = {
  used_phase_count: number;
}

export type WebpickerOrigin = {
  evaluation_mode: string;
  creation_info: WebpickerCreationInfo;
  time: WebpickerRealQuantity;
  quality: WebpickerQuality;
  latitude: WebpickerRealQuantity;
  longitude: WebpickerRealQuantity;
  depth: WebpickerRealQuantity;
  evaluation_status?: string;
}

export type WebpickerMagnitude = {
  mag: WebpickerRealQuantity;
  type: string;
}

export type WebpickerEventParameters = {
  public_id: string;
  type: string;
  _po: WebpickerOrigin;
  _pm?: WebpickerMagnitude;
  _region: string;
}

export type EventViewDataTableRow = {
  activity: string[] | null;
  time: string;
  mag: string;
  magType: string;
  phase: number;
  lat: string;
  lon: string;
  depth: string;
  eventType: string;
  mode: string;
  status: string;
  modeColor: string;
  author: string;
  author: string;
  region: string;
  id: string;
}
