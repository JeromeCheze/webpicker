import Highcharts from 'highcharts'

export type StringIndexedObject = {[index: string]: any}

export type ColorScaleItem = [number, [number, number, number]]

export type ColorScaleObject = ColorScaleItem[]

export type GenericAction = (a: ActionOpt, data: any) => void

export type FiliFilterOptions = {
  Fs: number;
  order: number;
  gain: number;
  preGain: boolean;
  characteristic: string;
  Fc?: number;
  BW?: number;
}

export type FilterDescription = {
  name: string;
  type: string;
  fc: number | [number, number];
  order: number;
}

export type SettingsFormStructFieldObject = {
  component: string;
  props: StringIndexedObject;
  value?: any;
  default?: any;
}
export type SettingsFormStructFormObject = {
  label: string;
  fields: {[index: string]: SettingsFormStructFieldObject};
}
export type SettingsFormStruct = {[index: string]: SettingsFormStructFormObject}

export type ColorValue = {
  hex: string;
  rgba: Record<string, string>;
}

export type EventToolsStationMagnitudeItem = {
  key: string;
  value: boolean;
}

export type AjaxOptions = {
  url: string;
  method: string;
  args?: object;
  type?: XMLHttpRequestResponseType;
  dataMimeType?: string;
  data?: string;
}

export type SetAuthorObject = {
  author: string;
  remember: boolean;
}

export interface StatusMessageObject extends StringIndexedObject {
  author: string;
  action: string;
  eventid: string;
  time: string;
}

export type StatusMessageMap = {
  [uid: string]: StatusMessageObject;
}

export interface AuthorStatus extends StatusMessageMap {
  __message__?: StatusMessageMap;
}

export type ActivityObject = Record<string, string[]>

export type NotificationObject = {
  color: string;
  text: string;
  value?: boolean;
}

export type LoadingObject = {
  value: boolean;
  text: string;
}

export interface WebpickerForm extends StringIndexedObject {
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

export type StationTheoreticalTravelTimeObject = {
  distance: number;
  ttt: Record<string, number>
}

export type TheoreticalTravelTimeObject = {
  [index: string]: StationTheoreticalTravelTimeObject;
}

export interface WebpickerChannel extends StringIndexedObject {
  azimuth: number;
  dip: number;
  scale: number;
  depth: number;
  starttime: Date;
  endtime: Date;
  'sample_rate': number;
  units: string;
}

export interface WebpickerStation extends StringIndexedObject {
  lat: number;
  lon: number;
  alt: number;
  location: Record<string, Record<string, WebpickerChannel[]>>;
}

export type WebpickerInventory = Record<string, Record<string, WebpickerStation>>

export type WebpickerWaveformId = {
  'network_code': string;
  'station_code': string;
  'location_code'?: string;
  'channel_code': string;
  value?: string;
}

export type WebpickerCreationInfo = {
  author: string;
  'agency_id': string;
  'creation_time': string;
  '_creation_time'?: Date;
  '_pretty_creation_time'?: string;
}

export type WebpickerTimeQuantity = {
  value: string;
  'upper_uncertainty'?: number;
  'lower_uncertainty'?: number;
  _pretty: string;
  _value: Date;
}

export type WebpickerRealQuantity = {
  value: number;
  uncertainty?: number;
  _pretty?: string;
  '_pretty_uncertainty'?: string;
}

export type WebpickerQuality = {
  'used_phase_count': number;
  'standard_error': number;
  'azimuthal_gap': number;
  'minimum_distance': number;
}

export type WebpickerPick = {
  'public_id': string;
  time: WebpickerTimeQuantity;
  'waveform_id': WebpickerWaveformId;
  'creation_info': WebpickerCreationInfo;
  'filter_id': string;
  'evaluation_mode': string;
  polarity?: string;
  _seedid: string;
  _fdsnid: string;
}

export type WebpickerArrival = {
  'public_id'?: string;
  'time_weight': number;
  'pick_id': string;
  phase: string;
  distance: number;
  azimuth: number;
  'time_residual': number;
  'takeoff_angle'?: WebpickerRealQuantity;
  _pick: WebpickerPick;
  _traveltime?: Date;
}

export type WebpickerOrigin = {
  'public_id': string;
  'evaluation_mode': string;
  'evaluation_status'?: string | null;
  'creation_info': WebpickerCreationInfo;
  time: WebpickerTimeQuantity;
  quality: WebpickerQuality;
  latitude: WebpickerRealQuantity;
  longitude: WebpickerRealQuantity;
  depth: WebpickerRealQuantity;
  arrival: WebpickerArrival[];
  '_not_committed'?: boolean;
  '_is_dirty'?: boolean;
  region: string;
}

export type WebpickerAmplitude = {
  'public_id': string;
  'waveform_id': WebpickerWaveformId;
  _seedid: string;
}

export type WebpickerStationMagnitude = {
  'public_id': string;
  'amplitude_id': string;
  mag: WebpickerRealQuantity;
  'waveform_id': WebpickerWaveformId;
  _seedid?: string;
  _amplitude?: WebpickerAmplitude;
}

export type WebpickerStationMagnitudeContribution = {
  'station_magnitude_id': string;
  residual?: number;
  weight: number;
  '_pretty_residual'?: string;
  '_pretty_weight'?: string;
  '_station_magnitude'?: WebpickerStationMagnitude;
}

export type WebpickerMagnitude = {
  'public_id': string;
  'origin_id': string;
  'creation_info': WebpickerCreationInfo;
  mag: WebpickerRealQuantity;
  'station_magnitude_contribution'?: WebpickerStationMagnitudeContribution[];
  type: string;
}

export type WebpickerNodalPlane = {
  strike: WebpickerRealQuantity;
  dip: WebpickerRealQuantity;
  rake: WebpickerRealQuantity;
}

export type WebpickerNodalPlanes = {
  'nodal_plane1': WebpickerNodalPlane;
}

export type WebpickerFocalMechanism = {
  'public_id': string;
  '_not_committed'?: boolean;
  'nodal_planes': WebpickerNodalPlanes;
}

export type WebpickerEventParametersDescription = {
  text: string;
  type: string;
}

export type WebpickerEventParameters = {
  origin: WebpickerOrigin[];
  'public_id': string;
  type?: string;
  'type_certainty'?: string | null;
  'preferred_origin_id'?: string;
  'preferred_magnitude_id'?: string | null;
  'preferred_focal_mechanism_id'?: string | null;
  'focal_mechanism'?: WebpickerFocalMechanism[];
  pick?: WebpickerPick[];
  'creation_info'?: WebpickerCreationInfo;
  amplitude?: WebpickerAmplitude[];
  'station_magnitude'?: WebpickerStationMagnitude[];
  magnitude?: WebpickerMagnitude[];
  description?: WebpickerEventParametersDescription[];
  _po?: WebpickerOrigin | null;
  _pm?: WebpickerMagnitude | null;
  _pfm?: WebpickerFocalMechanism | null;
  _region?: string;
}

export type ComposeEventObject = {
  base: WebpickerEventParameters;
  origins: WebpickerOrigin[];
  po?: WebpickerOrigin;
  magnitudes?: WebpickerMagnitude[];
  pm?: WebpickerMagnitude;
  pfm?: WebpickerFocalMechanism;
  discardedStation?: string[];
  focalMechanisms?: WebpickerFocalMechanism[];
}

export type ListViewDataTableRow = {
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

export type EventViewArrivalTableRow = {
  id: string;
  mode: string;
  modeColor: string;
  phase: string;
  network: string;
  station: string;
  loccha: string;
  takeoffAngle: string;
  polarity: string;
  residual: number;
  distance: number;
  azimuth: number;
  time: Date;
  weight: number;
}

// export type EventViewArrivalTableDataPagination = {
//   descending: boolean;
//   page: number;
//   rowsPerPage: number;
//   sortBy: string;
//   totalItems: number | null;
// }

export interface ComplexPoint extends Highcharts.Point {
  manual: boolean;
  id: string;
  y: number;
  category?: string;
  colorIndex?: number;
  index?: number;
  options?: Highcharts.PointOptionsObject;
  selected?: boolean;
  series?: Highcharts.Series;
  visible?: boolean;
  getClassName?: () => string;
  getLabelConfig?: () => Highcharts.PointLabelObject;
  getZone?: () => Highcharts.SeriesZonesOptionsObject;
  haloPath?: () => Highcharts.SVGPathArray;
  init?: (series: Highcharts.Series, options: Highcharts.PointOptionsType, x?: number) => Highcharts.Point;
  onMouseOut?: () => void;
  onMouseOver?: (e: Highcharts.PointerEventObject) => void;
  optionsToObject?: (options: Highcharts.PointOptionsType) => Highcharts.Dictionary<any>;
  remove?: (redraw?: boolean, animation?: (boolean|Partial<Highcharts.AnimationOptionsObject>)) => void;
  select?: (selected?: boolean, accumulate?: boolean) => void;
  setNestedProperty?: <T>(object: T, value: any, key: string) => T;
  setState?: (state?: (''|PointStateValue), move?: boolean) => void;
  setVisible?: (vis?: boolean, redraw?: boolean) => void;
  tooltipFormatter?: (pointFormat: string) => string;
  update?: (options: PointOptionsType, redraw?: boolean, animation?: (boolean|Partial<AnimationOptionsObject>)) => void;
}

export type MagnitudeComplexPoint = {
  x: number;
  y?: number;
  id?: string;
  color?: Highcharts.ColorString | Highcharts.GradientColorObject | Highcharts.PatternObject;
  type?: string;
  weight?: number;
}

export interface EventViewChartSeries extends StringIndexedObject {
  p: ComplexPoint[];
  s: ComplexPoint[];
}

export type State = {
  root: string;

  author: string | null;
  authorDialog: boolean;
  agencyId: string;

  defaultSettings: WebpickerSettings;
  settings: WebpickerSettings;

  loading: boolean;
  loadingMsg: string;

  notificationList: NotificationObject[];

  authorStatus: AuthorStatus;
  alertEventLocked: string[] | null;
  alertEventLockedDialog: boolean;
  acknowledgedMsgIds: string[];

  eventList: WebpickerEventParameters[];
  eventListDirty: boolean;

  currentEvent: WebpickerEventParameters | null;
  currentOrigin: WebpickerOrigin | null;
  currentFocalMechanism: WebpickerFocalMehanism | null | undefined;
  inventory: WebpickerInventory;

  traceCache: {};
  tttCache: TheoreticalTravelTimeObject;
  pickerLastOrigin: WebpickerOrigin | null;

  form: WebpickerForm;

  log: string[];
}
