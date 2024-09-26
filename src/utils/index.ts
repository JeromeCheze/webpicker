const EARTH_RADIUS = 6371

export const blurActiveElement = () => {
  if (document.activeElement != null) {
    const e = document.activeElement as HTMLElement
    e.blur()
  }
}

export const getLocalStorageDefault = (key: string, defaultValue: any) => {
  const value = localStorage.getItem(key)
  return value != null ? JSON.parse(value) : defaultValue
}

export const setLocalStorage = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value))
}

export const shortcutString = (ev: KeyboardEvent) => {
  const k = []
  const keyCode = ev.keyCode || ev.which || ev.charCode || ev.key.charCodeAt(0)
  if (ev.metaKey) k.push('meta')
  if (ev.ctrlKey) k.push('ctrl')
  if (ev.altKey) k.push('alt')
  if (ev.shiftKey) k.push('shift')
  if (keyCode === 32) {
    k.push('space')
  } else if (keyCode >= 48 && keyCode <= 126) {
    k.push(String.fromCharCode(keyCode))
  } else {
    k.push(ev.key)
  }
  let kStr = k.join('+').toLowerCase()
  if (kStr.indexOf('arrow') >= 0) {
    kStr = kStr.replace('arrow', '')
  }
  return kStr
}

export function parseFilter(f: string) {
  const r = /^(lowpass|bandpass|highpass)\((\d+), ?(\d+\.?\d*),? ?(\d+\.?\d*)?\)$/
  const m = r.exec(f)
  if (m != null) {
    return m[1] === 'bandpass'
      ? { type: m[1], order: parseInt(m[2]), fc: [parseFloat(m[3]), parseFloat(m[4])] }
      : { type: m[1], order: parseInt(m[2]), fc: [parseFloat(m[3])] }
  }
  return null
}

// export function deepCopy(o: any): any {
//   if (o instanceof Array) {
//     return o.map(item => deepCopy(item))
//   } else if (o instanceof Object) {
//     const dest: Record<string, any> = {}
//     for (const [k, v] of Object.entries(o as Record<string, any>)) {
//       dest[k] = deepCopy(v)
//     }
//     return dest
//   } else {
//     return o
//   }
// }
export function deepCopy(o: any): any {
  return JSON.parse(JSON.stringify(o))
}

export function getDefault(obj: Record<string, any>, key: string, value: any) {
  if (obj[key] == null) {
    obj[key] = value
  }
  return obj[key]
}

export function pushUnique(l: any[], item: any) {
  if (l.indexOf(item) < 0) {
    l.push(item)
  }
  return l
}

export function getId(prefix: string) {
  const now = new Date().toISOString()
  return prefix === 'Event'
    ? now.replace(/[-:]/g, '').replace(/[T.]/g, '_').slice(0, 19)
    : [
        prefix,
        now.replace(/[-:]/g, '').replace('T', '.').slice(0, 18),
        (Math.random() * 1000).toFixed(0)
      ].join('-')
}

export function toNetSta(seedid: string) {
  return seedid.split('.').slice(0, 2).join('.')
}


export function kmToDeg(km: number) {
  return km / (EARTH_RADIUS * 2 * Math.PI / 360)
}

export function degToKm(d: number) {
  return d * (EARTH_RADIUS * 2 * Math.PI / 360)
}

function DegToRad(d: number) {
  return d * Math.PI / 180
}

function RadToDeg(r: number) {
  return r * 180 / Math.PI
}

export function getDistanceAzimuth(lat1: number, lon1: number, lat2: number, lon2: number) {
  lat1 = DegToRad(lat1)
  lon1 = DegToRad(lon1)
  lat2 = DegToRad(lat2)
  lon2 = DegToRad(lon2)
  const deltaLat = lat2 - lat1
  const deltaLon = lon2 - lon1
  const a = Math.pow(Math.sin(deltaLat / 2), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(deltaLon / 2), 2)
  const d = 2 * EARTH_RADIUS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const az = RadToDeg(Math.atan2(
    Math.sin(deltaLon) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon)))
  return [d, az < 0 ? az + 360 : az]
}
