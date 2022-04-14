import { AjaxOptions, ColorScaleObject, ComposeEventObject, StringIndexedObject, WebpickerEventParameters, WebpickerInventory, WebpickerOrigin, WebpickerPick, WebpickerWaveformId } from '@/types'
import L from 'leaflet'

const EARTH_RADIUS = 6371e3 // meters

export const CONVERSION_RULES = {
  // keep list for all these nodes :
  '/event_parameters/event': true,
  '/event_parameters/event/amplitude': true,
  '/event_parameters/event/station_magnitude': true,
  '/event_parameters/event/magnitude/station_magnitude_contribution': true,
  '/event_parameters/event/origin': true,
  '/event_parameters/event/origin/arrival': true,
  '/event_parameters/event/magnitude': true,
  '/event_parameters/event/pick': true,
  '/event_parameters/event/description': true,
  '/event_parameters/event/focal_mechanism': true,
  // conversion function :
  '/event_parameters/event/origin/latitude/value': parseFloat,
  '/event_parameters/event/origin/latitude/uncertainty': parseFloat,
  '/event_parameters/event/origin/longitude/value': parseFloat,
  '/event_parameters/event/origin/longitude/uncertainty': parseFloat,
  '/event_parameters/event/origin/depth/value': parseFloat,
  '/event_parameters/event/origin/depth/uncertainty': parseFloat,
  '/event_parameters/event/origin/time/uncertainty': parseFloat,
  '/event_parameters/event/origin/quality/standard_error': parseFloat,
  '/event_parameters/event/origin/quality/azimuthal_gap': parseFloat,
  '/event_parameters/event/origin/quality/associated_phase_count': parseInt,
  '/event_parameters/event/origin/quality/associated_station_count': parseInt,
  '/event_parameters/event/origin/quality/used_phase_count': parseInt,
  '/event_parameters/event/origin/quality/used_station_count': parseInt,
  '/event_parameters/event/origin/quality/minimum_distance': parseFloat,
  '/event_parameters/event/origin/quality/maximum_distance': parseFloat,
  '/event_parameters/event/origin/quality/median_distance': parseFloat,
  '/event_parameters/event/origin/arrival/time_residual': parseFloat,
  '/event_parameters/event/origin/arrival/time_weight': parseFloat,
  '/event_parameters/event/origin/arrival/distance': parseFloat,
  '/event_parameters/event/origin/arrival/azimuth': parseFloat,
  '/event_parameters/event/origin/arrival/takeoff_angle/value': parseFloat,
  '/event_parameters/event/magnitude/mag/value': parseFloat,
  '/event_parameters/event/magnitude/mag/uncertainty': parseFloat,
  '/event_parameters/event/magnitude/stationCount': parseInt,
  '/event_parameters/event/magnitude/station_magnitude_contribution/weight': parseFloat,
  '/event_parameters/event/magnitude/station_magnitude_contribution/residual': parseFloat,
  '/event_parameters/event/amplitude/generic_amplitude': parseFloat,
  '/event_parameters/event/amplitude/snr': parseFloat,
  '/event_parameters/event/amplitude/time_window/begin': parseFloat,
  '/event_parameters/event/amplitude/time_window/end': parseFloat,
  '/event_parameters/event/station_magnitude/mag/value': parseFloat,
  '/event_parameters/event/focal_mechanism/nodal_planes/nodal_plane1/strike/value': parseInt,
  '/event_parameters/event/focal_mechanism/nodal_planes/nodal_plane1/dip/value': parseInt,
  '/event_parameters/event/focal_mechanism/nodal_planes/nodal_plane1/rake/value': parseInt
}

export const RESOURCE_ID_KEYS = [
  '/event_parameters/event/public_id',
  '/event_parameters/event/preferred_origin_id',
  '/event_parameters/event/preferred_magnitude_id',
  '/event_parameters/event/preferred_focal_mechanism_id',
  '/event_parameters/event/origin/public_id',
  '/event_parameters/event/origin/earth_model_id',
  '/event_parameters/event/origin/method_id',
  '/event_parameters/event/origin/arrival/pick_id',
  '/event_parameters/event/magnitude/public_id',
  '/event_parameters/event/magnitude/method_id',
  '/event_parameters/event/magnitude/origin_id',
  '/event_parameters/event/magnitude/station_magnitude_contribution/station_magnitude_id',
  '/event_parameters/event/pick/public_id',
  '/event_parameters/event/pick/filter_id',
  '/event_parameters/event/station_magnitude/origin_id',
  '/event_parameters/event/station_magnitude/public_id',
  '/event_parameters/event/station_magnitude/amplitude_id',
  '/event_parameters/event/amplitude/public_id',
  '/event_parameters/event/amplitude/pick_id',
  '/event_parameters/event/focal_mechanism/public_id'
]

export const RESIDUAL_COLOR_SCALE = [
  [-1, [0, 0, 255]],
  [0, [255, 255, 255]],
  [1, [255, 0, 0]]
]

export const applyScale = (v: number, cs: ColorScaleObject) => {
  if (v <= cs[0][0]) {
    return cs[0][1]
  }
  if (v >= cs[cs.length-1][0]) {
    return cs[cs.length-1][1]
  }
  let i;
  for (i=0; cs[i][0] < v; i++);
  let r = (v - cs[i-1][0])/(cs[i][0] - cs[i-1][0]),
      result = []
  for (let j=0; j < cs[i][1].length; j++) {
    result.push(cs[i-1][1][j] + r * (cs[i][1][j] - cs[i-1][1][j]))
  }
  return result
}

export const toRGB = (rgb: [number, number, number]) => {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}

export const pushInObject = (obj: StringIndexedObject, key: string, value: any) => {
  if (obj[key] == null) {
    obj[key] = new Array()
  }
  obj[key].push(value)
}

export const pushUnique = (list: any[], value: any) => {
  if (list.indexOf(value) < 0) {
    list.push(value)
  }
}

export const ajax = (opt: AjaxOptions, xhr=new XMLHttpRequest()) => {
  return new Promise((resolve, reject) => {
    opt = Object.assign({
      method: 'GET', url: null, type: 'text', args: null, data: null, dataMimeType: null
    }, opt)
    if (opt.url == null) {
      throw new Error('"url" option is not defined')
    }
    const strArgs = (
      opt.args == null ? '' :
      '?' + Object.entries(opt.args).map(x => `${x[0]}=${x[1]}`).join('&')
    )
    xhr.open(opt.method, opt.url + strArgs)
    xhr.responseType = opt.type
    xhr.onerror = () => reject(xhr.status)
    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(xhr.response)
      } else {
        reject(xhr.status)
      }
    }
    if (opt.method == 'POST' && opt.dataMimeType != null) {
      xhr.setRequestHeader('Content-Type', opt.dataMimeType)
    }
    xhr.send(opt.data)
  });
}

export const toSnakeCase = (x: string) => {
  return x.replace(/([A-Z]+)/g, '_$1').toLowerCase()
}

export const removeResourcePrefix = (id: string) => {
  if (id.indexOf('smi:org.gfz-potsdam.de/geofon/') == 0) {
    return id.replace('smi:org.gfz-potsdam.de/geofon/', '')
  } else if (id.indexOf('smi:') == 0) {
    return id.split('/').slice(2).join('/')
  }
  console.warn(`Failed to remove prefix of resource ID: ${id}`)
  return id
}

// TODO: define proper type for rules
export const xmlNodeToJson = (x: Element, path: string, rules: any) => {
  path = `${path}/${toSnakeCase(x.tagName)}`
  let obj: StringIndexedObject = {}
  for (let a of x.attributes) {
    let key = toSnakeCase(a.name)
    let currentPath = `${path}/${key}`
    let conv = rules[currentPath]
    if (RESOURCE_ID_KEYS.indexOf(currentPath) >= 0) {
      conv = removeResourcePrefix
    }
    obj[key] = conv ? conv(a.value) : a.value
  }
  if (x.children.length == 0) {
    // console.log(path);
    let conv = rules[path]
    if (RESOURCE_ID_KEYS.indexOf(path) >= 0) {
      conv = removeResourcePrefix
    }
    // console.log(path, conv);
    let value = conv ? conv(x.textContent) : x.textContent
    return Object.keys(obj).length > 0 ? Object.assign(obj, { value }) : value
  } else {
    for (let c of x.children) {
      let key = toSnakeCase(c.tagName)
      let currentPath = `${path}/${key}`
      let value = xmlNodeToJson(c, path, rules)
      if (rules[currentPath] == true) {// it's a list
        if (obj[key] == null) {
          obj[key] = []
        }
        obj[key].push(value)
      } else {
        obj[key] = value
      }
    }
  }
  return obj
}

export const parseQuakeML = (qml: Document) => {
  let eventParametersTags = qml.getElementsByTagName('eventParameters')
  if (eventParametersTags.length === 0) {
    console.log('QuakeML is empty, no event parameters found.')
    return []
  }
  let events = xmlNodeToJson(
    eventParametersTags[0],
    '',
    CONVERSION_RULES
  ).event
  for (let e of events) {
    processEventData(e)
  }
  return events
}

export const blurActiveElement = () => {
  const activeElement = document.activeElement as HTMLElement
  activeElement.blur()
}

export const dict = (k_list: string[], v_list: string[]) => {
  let result: StringIndexedObject = {}
  for (let [i, k] of k_list.entries()) {
    result[k] = v_list[i]
  }
  return result
}

export const toSeedId = (wfid: WebpickerWaveformId) => {
  if (wfid.value) {
    delete wfid.value
  }
  let loc = wfid.location_code == null ? '' : wfid.location_code
  return [wfid.network_code, wfid.station_code, loc, wfid.channel_code].join('.')
}

export const processEventData = (e: WebpickerEventParameters) => {
  // e._id = e.public_id.split('/').slice(-1)[0]
  for (let o of e.origin) {
    o.time._value = new Date(Date.parse(o.time.value))
    o.time._pretty = o.time._value.toISOString().replace('T', ' ').substr(0, 19)
    o.creation_info._creation_time = new Date(Date.parse(o.creation_info.creation_time))
    o.creation_info._pretty_creation_time = o.creation_info._creation_time.toISOString().replace('T', ' ').substr(0, 19)
    let [lat, lon] = [o.latitude.value, o.longitude.value]
    o.latitude._pretty = lat > 0 ? `${lat.toFixed(2)}° N` : `${(-1*lat).toFixed(2)}° S`
    o.latitude._pretty_uncertainty = o.latitude.uncertainty != null ? `+/- ${(o.latitude.uncertainty).toFixed(1)} km` : ''
    o.longitude._pretty = lon > 0 ? `${lon.toFixed(2)}° E` : `${(-1*lon).toFixed(2)}° W`
    o.longitude._pretty_uncertainty = o.longitude.uncertainty != null ? `+/- ${(o.longitude.uncertainty).toFixed(1)} km` : ''
    o.depth._pretty = `${(o.depth.value/1000).toFixed(0)} km`
    o.depth._pretty_uncertainty = o.depth.uncertainty != null ? `+/- ${(o.depth.uncertainty/1000).toFixed(1)} km` : '(fixed)'
  }
  if (e.amplitude != null && e.station_magnitude != null) {
    for (let a of e.amplitude) {
      a._seedid = toSeedId(a.waveform_id)
    }
    for (let sm of e.station_magnitude) {
      sm._amplitude = e.amplitude.find(x => x.public_id == sm.amplitude_id)
      sm.mag._pretty = sm.mag.value.toFixed(2)
      sm._seedid = toSeedId(sm.waveform_id)
    }
  }
  if (e.magnitude != null) {
    for (let m of e.magnitude) {
      m.mag._pretty = m.mag.value.toFixed(2)
      m.creation_info._creation_time = new Date(Date.parse(m.creation_info.creation_time))
      m.creation_info._pretty_creation_time = m.creation_info._creation_time.toISOString().replace('T', ' ').substr(0, 19)
      // m._pretty_method = m.method_id != null ? m.method_id.split('/').slice(-1)[0] : ''
      if (e.station_magnitude != null && m.station_magnitude_contribution != null) {
        for (let smc of m.station_magnitude_contribution) {
          smc._station_magnitude = e.station_magnitude.find(x => x.public_id == smc.station_magnitude_id)
          if (smc.residual == null) {
            smc.residual = smc._station_magnitude!.mag.value - m.mag.value
          }
          smc._pretty_residual = smc.residual != null ? smc.residual.toFixed(2) : '-'
          smc._pretty_weight = smc.weight != null ? smc.weight.toFixed(2) : '-'
        }
      }
    }
  } else {
    e.magnitude = []
  }
  e._po = e.origin.find(x => x.public_id == e.preferred_origin_id) || null
  if (e._po != null && e._po.region) {
    e._region = e._po.region
  } else if (e.description) {
    e._region = e.description[0].text
  } else {
    e._region = ''
  }
  e._region = e._region.toUpperCase()
  if (e.preferred_magnitude_id) {
    e._pm = e.magnitude.find(x => x.public_id == e.preferred_magnitude_id)
  } else {
    e.preferred_magnitude_id = null
  }
  if (e.pick != null) {
    let pickMap: Record<string, WebpickerPick> = {}
    for (let p of e.pick) {
      if (p.creation_info != null) {
        p.creation_info._creation_time = new Date(Date.parse(p.creation_info.creation_time))
        p.creation_info._pretty_creation_time = p.creation_info._creation_time.toISOString().replace('T', ' ').substr(0, 19)
      }
      p.time._value = new Date(Date.parse(p.time.value))
      // p._id = p.public_id.split('/').slice(-1)[0]
      let wfid = p.waveform_id
      p._seedid = toSeedId(wfid)
      p._fdsnid = p._seedid.replace('..', '.--.')
      // pickMap[p._id] = p
      pickMap[p.public_id] = p
    }
    for (let o of e.origin) {
      let arrivalToIgnore = []
      for (let a of o.arrival) {
        if (a.public_id) {
          delete a.public_id
        }
        // a._pick_id = a.pick_id.split('/').slice(-1)[0]
        // a._pick = pickMap[a._pick_id]
        a.time_weight = a.time_weight == null ? 0 : a.time_weight
        a._pick = pickMap[a.pick_id]
        if (a._pick == null) {
          arrivalToIgnore.push(a)
          console.warn(`Can't find the pick ${a.pick_id} referenced by an arrival, ignoring arrival.`)
          continue
        }
        a._traveltime = new Date(a._pick.time._value.getTime() - o.time._value.getTime())
      }
      for (let a of arrivalToIgnore) {
        o.arrival.splice(o.arrival.indexOf(a), 1)
      }
    }
  }
  if (e.preferred_focal_mechanism_id != null && e.focal_mechanism != null) {
    e._pfm = e.focal_mechanism.find(x => x.public_id == e.preferred_focal_mechanism_id)
  }
}

export const parseInventory = (raw_inv:string) => {
  let cols = [
    'network', 'station', 'location', 'channel',
    'lat', 'lon', 'alt', 'depth',
    'azimuth', 'dip', '_', 'scale', '_', 'units',
    'sample_rate', 'starttime', 'endtime'
  ]
  let result: WebpickerInventory = {}
  let sp_inv = raw_inv.split(/[\r\n]+/g)
  for (let l of sp_inv) {
    if (l != '' && l[0] != '#') {
      let c = dict(cols, l.split('|'))
      if (result[c.network] == null) {
        result[c.network] = {}
      }
      if (result[c.network][c.station] == null) {
        result[c.network][c.station] = {
          lat: parseFloat(c.lat),
          lon: parseFloat(c.lon),
          alt: parseFloat(c.alt),
          location: {}
        }
      }
      if (result[c.network][c.station].location[c.location] == null) {
        result[c.network][c.station].location[c.location] = {}
      }
      if (result[c.network][c.station].location[c.location][c.channel] == null) {
        result[c.network][c.station].location[c.location][c.channel] = []
      }
      result[c.network][c.station].location[c.location][c.channel].push({
        azimuth: parseFloat(c.azimuth),
        dip: parseFloat(c.dip),
        scale: parseFloat(c.scale),
        depth: parseFloat(c.depth),
        starttime: new Date(Date.parse(c.starttime)),
        endtime: c.endtime == '' ? new Date() : new Date(Date.parse(c.endtime)),
        sample_rate: parseFloat(c.sample_rate),
        units: c.units
      })
    }
  }
  return result
}

export const cloneAndClean = (o: any, path: string): object => {
  let result
  if (o instanceof Array) {
    result = []
    for (let v of o) {
      result.push(cloneAndClean(v, path))
    }
  } else if (o instanceof Object) {
    result = {} as StringIndexedObject
    for (let [k, v] of Object.entries(o)) {
      if (k.indexOf('_') == 0 || v == null) {
        continue
      }
      result[k] = cloneAndClean(v, `${path}/${k}`)
    }
  } else {
    result = RESOURCE_ID_KEYS.indexOf(path) < 0 ? o : `smi:oca/1.0/${o}`
  }
  return result
}

export const composeEvent = (o: ComposeEventObject) => {
  let opt: ComposeEventObject = Object.assign({
    base: {},
    origins: [],
    po: null,
    magnitudes: [],
    focalMechanisms: [],
    pm: null,
    pfm: null,
    discardedStation: null
  }, o)
  let root = '/event_parameters/event'
  let result: StringIndexedObject = cloneAndClean(opt.base, root)
  result.pick = []
  let originList: WebpickerOrigin[] = []
  for (let o of opt.origins) {
    if (originList.find(x => x.public_id == o.public_id) != null) {
      continue
    }
    for (let a of o.arrival) {
      let netSta = a._pick._seedid.split('.').slice(0, 2).join('.')
      // add only picks of non discarded stations
      if (opt.discardedStation == null || (opt.discardedStation != null && opt.discardedStation.indexOf(netSta) < 0)) {
        result.pick.push(cloneAndClean(a._pick, `${root}/pick`))
      }
    }
    let cloneOrigin = cloneAndClean(o, `${root}/origin`) as WebpickerOrigin
    for (let i=cloneOrigin.arrival.length - 1; i >= 0; i--) {
      let pickFound = result.pick.find((x: WebpickerPick) => x.public_id == cloneOrigin.arrival[i].pick_id)
      if (pickFound == null) {
        // remove arrival of discarded station
        cloneOrigin.arrival.splice(i, 1)
        continue
      }
      if (opt.discardedStation != null) {
        // force usage of the station for magnitude computation
        cloneOrigin.arrival[i].time_weight = 1
      }
    }
    originList.push(cloneOrigin)
  }
  result.origin = originList
  result.magnitude = cloneAndClean(opt.magnitudes, `${root}/magnitude`)
  result.focal_mechanism = cloneAndClean(opt.focalMechanisms, `${root}/focal_mechanism`)
  if (opt.po != null) {
    result.preferred_origin_id = cloneAndClean(opt.po.public_id, `${root}/preferred_origin_id`)
  } else {
    delete result.preferred_origin_id
  }
  if (opt.pm != null) {
    result.preferred_magnitude_id = cloneAndClean(opt.pm.public_id, `${root}/preferred_magnitude_id`)
  } else {
    delete result.preferred_magnitude_id
  }
  if (opt.pfm != null) {
    result.preferred_focal_mechanism_id = cloneAndClean(opt.pfm.public_id, `${root}/preferred_focal_mechanism_id`)
  }
  return result
}

export const coordinates2azimuth = (latlon1: [number, number], latlon2: [number, number]) => {
  let [lat1, lon1, lat2, lon2] = latlon1.concat(latlon2)
  let x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
  let y = Math.sin(lon2 - lon1) * Math.cos(lat2)
  let result = Math.atan2(y, x) * 180 / Math.PI
  return result >= 0 ? result : result + 360
}

export const az2baz = (az: number) => {
  return (az + 180) % 360
}

export const shortcutString = (ev: KeyboardEvent) => {
  let k = []
  let keyCode = ev.keyCode || ev.which || ev.charCode || ev.key.charCodeAt(0)
  if (ev.metaKey) k.push('meta')
  if (ev.ctrlKey) k.push('ctrl')
  if (ev.altKey) k.push('alt')
  if (ev.shiftKey) k.push('shift')
  if (keyCode == 32) {
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

export const deg2m = (deg: number) => {
  return deg * 2 * Math.PI * EARTH_RADIUS / 360
}

export const m2deg = (m: number) => {
  return m * 360 / (2 * Math.PI * EARTH_RADIUS)
}

export const initMap = (container: HTMLElement) => {
  let map = L.map(container, { trackResize: false, attributionControl: false })
  let worldtopomap = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri, HERE, DeLorme, TomTom, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, <br>Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), swisstopo, MapmyIndia, © OpenStreetMap contributors, and the GIS User Community'
  })
  let satmap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, <br>USGS, AEX, Getmapping, Aerogrid, IGN, IGP, swisstopo, and the GIS User Community'
  })
  let baseLayers = {
    Terrain: worldtopomap,
    Satellite: satmap
  }
  L.control.layers(baseLayers).addTo(map);
  L.control.scale({ imperial: false }).addTo(map)
  worldtopomap.addTo(map)
  return map
}
