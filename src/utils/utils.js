const CONVERSION_RULES = {
  // keep list for all these nodes :
  '/eventParameters/event': true,
  '/eventParameters/event/origin': true,
  '/eventParameters/event/origin/arrival': true,
  '/eventParameters/event/magnitude': true,
  '/eventParameters/event/pick': true,
  '/eventParameters/event/description': true,
  // conversion function :
  '/eventParameters/event/origin/latitude/value': parseFloat,
  '/eventParameters/event/origin/latitude/uncertainty': parseFloat,
  '/eventParameters/event/origin/longitude/value': parseFloat,
  '/eventParameters/event/origin/longitude/uncertainty': parseFloat,
  '/eventParameters/event/origin/depth/value': parseFloat,
  '/eventParameters/event/origin/depth/uncertainty': parseFloat,
  '/eventParameters/event/origin/time/uncertainty': parseFloat,
  '/eventParameters/event/origin/quality/standardError': parseFloat,
  '/eventParameters/event/origin/quality/azimuthalGap': parseFloat,
  '/eventParameters/event/origin/quality/associatedPhaseCount': parseInt,
  '/eventParameters/event/origin/quality/associatedStationCount': parseInt,
  '/eventParameters/event/origin/quality/usedPhaseCount': parseInt,
  '/eventParameters/event/origin/quality/usedStationCount': parseInt,
  '/eventParameters/event/origin/quality/minimumDistance': parseFloat,
  '/eventParameters/event/origin/quality/maximumDistance': parseFloat,
  '/eventParameters/event/origin/quality/medianDistance': parseFloat,
  '/eventParameters/event/origin/arrival/timeResidual': parseFloat,
  '/eventParameters/event/origin/arrival/timeWeight': parseFloat,
  '/eventParameters/event/origin/arrival/distance': parseFloat,
  '/eventParameters/event/origin/arrival/azimuth': parseFloat,
  '/eventParameters/event/magnitude/mag/value': parseFloat,
  '/eventParameters/event/magnitude/mag/uncertainty': parseFloat,
  '/eventParameters/event/magnitude/stationCount': parseInt
}


function ajax(opt, xhr) {
  if (xhr == null) {
    xhr = new XMLHttpRequest()
  }
  return new Promise((resolve, reject) => {
    opt = Object.assign({
      method: 'GET', url: null, type: 'text', args: null, data: null, dataMimeType: null
    }, opt)
    if (opt.url == null) {
      throw new Error('"url" option is not defined')
    }
    opt.args = (
      opt.args == null ? '' :
      '?' + Object.entries(opt.args).map(x => `${x[0]}=${x[1]}`).join('&')
    )
    xhr.open(opt.method, opt.url+opt.args)
    xhr.responseType = opt.type
    xhr.onerror = () => reject(xhr.statusText)
    xhr.onload = () => {
      if (xhr.status != 0) {
        resolve(xhr.response)
      }
    }
    if (opt.method == 'POST' && opt.dataMimeType != null) {
      xhr.setRequestHeader('Content-Type', opt.dataMimeType)
    }
    xhr.send(opt.data)
  });
}

function toSnakeCase(x) {
  return x.replace(/([A-Z]+)/g, '_$1').toLowerCase()
}

function xmlNodeToJson(x, path, rules) {
  path = `${path}/${x.tagName}`
  let obj = {}
  for (let a of x.attributes) {
    let key = a.name
    let currentPath = `${path}/${key}`
    let conv = rules[currentPath]
    obj[toSnakeCase(key)] = conv ? conv(a.value) : a.value
  }
  if (x.children.length == 0) {
    // console.log(path);
    let conv = rules[path]
    // console.log(path, conv);
    let value = conv ? conv(x.textContent) : x.textContent
    return Object.keys(obj).length > 0 ? Object.assign(obj, { value }) : value
  } else {
    for (let c of x.children) {
      let currentPath = `${path}/${c.tagName}`
      let key = toSnakeCase(c.tagName)
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

function dict(k_list, v_list) {
  let result = {}
  for (let [i, k] of k_list.entries()) {
    result[k] = v_list[i]
  }
  return result
}

function processEventData(e) {
  e._id = e.public_id.split('/').slice(-1)[0]
  for (let o of e.origin) {
    o.time._value = new Date(Date.parse(o.time.value))
    o.time._pretty = o.time._value.toISOString().replace('T', ' ').substr(0, 19)
    let [lat, lon] = [o.latitude.value, o.longitude.value]
    o.latitude._pretty = lat > 0 ? `${lat.toFixed(2)}° N` : `${(-1*lat).toFixed(2)}° S`
    o.latitude._pretty_uncertainty = `+/- ${(o.latitude.uncertainty).toFixed(1)} km`
    o.longitude._pretty = lon > 0 ? `${lon.toFixed(2)}° E` : `${(-1*lon).toFixed(2)}° W`
    o.longitude._pretty_uncertainty = `+/- ${(o.longitude.uncertainty).toFixed(1)} km`
    o.depth._pretty = `${(o.depth.value/1000).toFixed(0)} km`
    o.depth._pretty_uncertainty = `+/- ${(o.depth.uncertainty/1000).toFixed(1)} km`
  }
  if (e.magnitude != null) {
    for (let m of e.magnitude) {
      m.mag._pretty = m.mag.value.toFixed(2)
      m._pretty_method = m.method_id != null ? m.method_id.split('/').slice(-1)[0] : ''
    }
  } else {
    e.magnitude = []
  }
  e._po = e.origin.find(x => x.public_id == e.preferred_origin_id)
  if (e.preferred_magnitude_id) {
    e._pm = e.magnitude.find(x => x.public_id == e.preferred_magnitude_id)
  }
  if (e.pick != null && e._po.arrival != null) {
    let pickMap = {}
    for (let p of e.pick) {
      p.time._value = new Date(Date.parse(p.time.value))
      p._id = p.public_id.split('/').slice(-1)[0]
      let wfid = p.waveform_id
      delete p.waveform_id.value
      let loc = wfid.location_code == null ? '' : wfid.location_code
      p._seedid = [wfid.network_code, wfid.station_code, loc, wfid.channel_code].join('.')
      p._fdsnid = p._seedid.replace('..', '.--.')
      pickMap[p.public_id] = p
    }
    for (let o of e.origin) {
      for (let a of o.arrival) {
        a._pick = pickMap[a.pick_id]
        a._traveltime = new Date(a._pick.time._value - o.time._value)
      }
    }
  }
}

function parseInventory(raw_inv) {
  let cols = [
    'network', 'station', 'location', 'channel',
    'lat', 'lon', 'alt', 'depth',
    'azimuth', 'dip', '_', 'scale', '_', 'scaleUnits',
    'sampleRate', 'starttime', 'endtime'
  ]
  let result = {}
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
          alt: parseFloat(c.alt)
        }
      }
      if (result[c.network][c.station][c.location] == null) {
        result[c.network][c.station][c.location] = {}
      }
      if (result[c.network][c.station][c.location][c.channel] == null) {
        result[c.network][c.station][c.location][c.channel] = []
      }
      result[c.network][c.station][c.location][c.channel].push({
        azimuth: parseFloat(c.azimuth),
        dip: parseFloat(c.dip),
        scale: parseFloat(c.scale),
        depth: parseFloat(c.depth),
        starttime: new Date(Date.parse(c.starttime)),
        endtime: c.endtime == '' ? new Date() : new Date(Date.parse(c.endtime)),
        units: c.scaleUnits
      })
    }
  }
  return result
}

function cloneAndClean(o) {
  let result
  if (o instanceof Array) {
    result = []
    for (let v of o) {
      result.push(cloneAndClean(v))
    }
  } else if (o instanceof Object) {
    result = {}
    for (let [k, v] of Object.entries(o)) {
      if (k.indexOf('_') == 0) {
        continue
      }
      result[k] = cloneAndClean(v)
    }
  } else {
    result = o
  }
  return result
}

function composeEvent(o) {
  let opt = Object.assign({ base: {}, origins: [], po: null, magnitudes: [], pm: null }, o)
  let result = cloneAndClean(opt.base)
  result.pick = []
  let originList = []
  for (let o of opt.origins) {
    if (originList.find(x => x.public_id == o.public_id) != null) {
      continue
    }
    for (let a of o.arrival) {
      result.pick.push(cloneAndClean(a._pick))
    }
    originList.push(cloneAndClean(o))
  }
  result.origin = originList
  result.magnitude = cloneAndClean(opt.magnitudes)
  if (opt.po != null) {
    result.preferred_origin_id = opt.po.public_id
  } else {
    delete result.preferred_origin_id
  }
  if (opt.pm != null) {
    result.preferred_magnitude_id = opt.pm.public_id
  } else {
    delete result.preferred_magnitude_id
  }
  return result
}

export default {
  CONVERSION_RULES,
  ajax,
  dict,
  processEventData,
  xmlNodeToJson,
  parseInventory,
  cloneAndClean,
  composeEvent
}
