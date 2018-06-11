const CONVERSION_RULES = {
  // keep list for all these nodes :
  '/eventParameters/event': true,
  '/eventParameters/event/origin': true,
  '/eventParameters/event/origin/arrival': true,
  '/eventParameters/event/magnitude': true,
  '/eventParameters/event/pick': true,
  // conversion function :
  // '/eventParameters/event/publicID': x => x.split('/').slice(-1)[0],
  '/eventParameters/event/origin/latitude/value': parseFloat,
  '/eventParameters/event/origin/latitude/uncertainty': parseFloat,
  '/eventParameters/event/origin/longitude/value': parseFloat,
  '/eventParameters/event/origin/longitude/uncertainty': parseFloat,
  '/eventParameters/event/origin/depth/value': parseFloat,
  '/eventParameters/event/origin/depth/uncertainty': parseFloat,
  '/eventParameters/event/origin/time/value': x => new Date(Date.parse(x)),
  '/eventParameters/event/origin/time/uncertainty': parseFloat,
  '/eventParameters/event/origin/quality/standardError': parseFloat,
  '/eventParameters/event/origin/quality/minimumDistance': parseFloat,
  '/eventParameters/event/origin/quality/azimuthalGap': parseFloat,
  '/eventParameters/event/origin/quality/usedPhaseCount': parseInt,
  // '/eventParameters/event/origin/arrival/pickID': x => x.split('/').slice(-1)[0],
  '/eventParameters/event/origin/arrival/timeResidual': parseFloat,
  '/eventParameters/event/origin/arrival/timeWeight': parseFloat,
  '/eventParameters/event/origin/arrival/distance': parseFloat,
  '/eventParameters/event/origin/arrival/azimuth': parseFloat,
  '/eventParameters/event/magnitude/mag/value': parseFloat,
  '/eventParameters/event/magnitude/mag/uncertainty': parseFloat,
  // '/eventParameters/event/pick/publicID': x => x.split('/').slice(-1)[0],
  '/eventParameters/event/pick/time/value': x => new Date(Date.parse(x))
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

function toUndercase(x) {
  return x.replace(/([A-Z]+)/g, '_$1').toLowerCase()
}

function xmlNodeToJson(x, path, rules) {
  path = `${path}/${x.tagName}`
  let obj = {}
  for (let a of x.attributes) {
    let key = a.name
    let currentPath = `${path}/${key}`
    let conv = rules[currentPath]
    obj[toUndercase(key)] = conv ? conv(a.value) : a.value
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
      let key = toUndercase(c.tagName)
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
  e.id = e.public_id.split('/').slice(-1)[0]
  for (let o of e.origin) {
    o.time.pretty = o.time.value.toISOString().replace('T', ' ').substr(0, 19)
    let [lat, lon] = [o.latitude.value, o.longitude.value]
    o.latitude.pretty = lat > 0 ? `${lat.toFixed(2)}° N` : `${(-1*lat).toFixed(2)}° S`
    o.latitude.prettyUncertainty = `+/- ${(o.latitude.uncertainty).toFixed(1)} km`
    o.longitude.pretty = lon > 0 ? `${lon.toFixed(2)}° E` : `${(-1*lon).toFixed(2)}° W`
    o.longitude.prettyUncertainty = `+/- ${(o.longitude.uncertainty).toFixed(1)} km`
    o.depth.pretty = `${(o.depth.value/1000).toFixed(0)} km`
    o.depth.prettyUncertainty = `+/- ${(o.depth.uncertainty/1000).toFixed(1)} km`
  }
  if (e.magnitude != null) {
    for (let m of e.magnitude) {
      m.mag.pretty = m.mag.value.toFixed(2)
      m.prettyMethod = m.method_id.split('/').slice(-1)[0]
    }
  }
  e.po = e.origin.find(x => x.public_id == e.preferred_origin_id)
  if (e.preferred_magnitude_id) {
    e.pm = e.magnitude.find(x => x.public_id == e.preferred_magnitude_id)
  }
  if (e.pick != null && e.po.arrival != null) {
    let pickMap = {}
    for (let p of e.pick) {
      p.id = p.public_id.split('/').slice(-1)[0]
      let wfid = p.waveform_id
      if (wfid.location_code == null) {
        wfid.location_code = '--'
      }
      p.seedid = [wfid.network_code, wfid.station_code, wfid.location_code, wfid.channel_code].join('.')
      pickMap[p.public_id] = p
    }
    for (let o of e.origin) {
      for (let a of o.arrival) {
        a.pick = pickMap[a.pick_id]
        a.time = new Date(a.pick.time.value - o.time.value)
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

function toJquake(eventId, originList, po, magList, pm) {
  let e = {
    public_id: `smi:oca/${eventId}`,
    preferred_origin_id: po.public_id,
    magnitude: [],
    origin: [],
    pick: []
  }
  for (let o of originList) {
    let arrivals = []
    for (let a of o.arrival) {
      let p = {
        public_id: a.pick.public_id,
        time: { value: a.pick.time.value },
        phase_hint: a.pick.phase_hint,
        waveform_id: {
          network_code: a.pick.waveform_id.network_code,
          station_code: a.pick.waveform_id.station_code,
          channel_code: a.pick.waveform_id.channel_code
        }
      }
      if (a.pick.polarity != null) {
        p.polarity = a.pick.polarity
      }
      if (a.pick.waveform_id.location_code != '--') {
        p.waveform_id.location_code = a.pick.waveform_id.location_code
      }
      e.pick.push(p)
      arrivals.push({
        public_id: `smi:oca/N.A`,
        pick_id: p.public_id,
        phase: a.phase,
        azimuth: a.azimuth,
        distance: a.distance,
        time_residual: a.time_residual,
        time_weight: a.time_weight
      })
    }
    e.origin.push({
      public_id: o.public_id,
      time: { value: o.time.value, uncertainty: o.time.uncertainty },
      latitude: { value: o.latitude.value, uncertainty: o.latitude.uncertainty },
      longitude: { value: o.longitude.value, uncertainty: o.longitude.uncertainty },
      depth: { value: o.depth.value, uncertainty: o.depth.uncertainty },
      arrival: arrivals
    })
  }
  if (magList != null) {
    for (let m of magList) {
      e.magnitude.push({
        public_id: m.public_id,
        mag: { value: m.mag.value },
        method_id: m.method_id,
        station_count: m.station_count,
        type: m.type
      })
    }
  }
  if (pm != null) {
    e.preferred_magnitude_id = pm.public_id
  }
  return [e]
}

export default {
  CONVERSION_RULES,
  ajax,
  dict,
  processEventData,
  xmlNodeToJson,
  parseInventory,
  toJquake
}
