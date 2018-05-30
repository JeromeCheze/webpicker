function ajax(opt) {
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
    const xhr = new XMLHttpRequest()
    xhr.open(opt.method, opt.url+opt.args)
    xhr.responseType = opt.type
    xhr.onload = () => resolve(xhr.response)
    xhr.onerror = () => reject(xhr.statusText)
    if (opt.method == 'POST' && opt.dataMimeType != null) {
      xhr.setRequestHeader('Content-Type', opt.dataMimeType)
    }
    xhr.send(opt.data)
  });
}

function xmlNodeToJson(x, path, rules) {
  path = `${path}/${x.tagName}`
  let obj = {}
  for (let a of x.attributes) {
    let key = `$${a.name}`
    let currentPath = `${path}/${key}`
    // console.log(currentPath);
    let conv = rules[currentPath]
    obj[key] = conv ? conv(a.value) : a.value
  }
  if (x.children.length == 0) {
    // console.log(path);
    let conv = rules[path]
    let value = conv ? conv(x.textContent) : x.textContent
    return Object.keys(obj).length > 0 ? Object.assign(obj, { value }) : value
  } else {
    for (let c of x.children) {
      if (obj[c.tagName] == null) {
        obj[c.tagName] = []
      }
      obj[c.tagName].push(xmlNodeToJson(c, path, rules))
    }
    for (let [k, v] of Object.entries(obj)) {
      let currentPath = `${path}/${k}`
      // console.log(currentPath);
      if (rules[currentPath] != true &&
          v instanceof Array &&
          v.length == 1) {
        obj[k] = v[0]
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
    }
  }
  e.po = e.origin.find(x => x.$publicID == e.preferredOriginID)
  if (e.preferredMagnitudeID) {
    e.pm = e.magnitude.find(x => x.$publicID == e.preferredMagnitudeID)
  }
  if (e.pick != null && e.po.arrival != null) {
    let pickMap = {}
    for (let p of e.pick) {
      let wfid = p.waveformID
      if (wfid.$locationCode == null) {
        wfid.$locationCode = '--'
      }
      p.seedid = [wfid.$networkCode, wfid.$stationCode, wfid.$locationCode, wfid.$channelCode].join('.')
      pickMap[p.$publicID] = p
    }
    for (let o of e.origin) {
      for (let a of o.arrival) {
        a.pick = pickMap[a.pickID]
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

export default {
  ajax,
  dict,
  processEventData,
  xmlNodeToJson,
  parseInventory
}
