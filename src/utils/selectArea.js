import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

export default class SelectArea {
  constructor (bounds) {
    this.__customEvents = {}
    let latmin = bounds[0][0],
        lonmin = bounds[0][1],
        latmax = bounds[1][0],
        lonmax = bounds[1][1]
    this.__bounds = L.latLngBounds(bounds[0], bounds[1])
    this.__rectangle = L.rectangle(this.__bounds, {
      stroke: true, color: 'black', weight: 2, opacity: 1,
      fill: true, fillColor: 'black', fillOpacity: 0.1,
      interactive: true, bubblingMouseEvents: false
    })
    let styleId = 'select-area-style'
    if (document.getElementById(styleId) == null) {
      let s = document.createElement('style')
      s.id = styleId
      s.innerHTML = `
        .circle {width: 10px; height: 10px; background: white; border: 1px solid black; border-radius: 6px;}
        .c-nesw-resize {cursor: nesw-resize;}
        .c-nwse-resize {cursor: nwse-resize;}`
      document.head.appendChild(s);
    }
    let iconNSResize = L.divIcon({className: 'circle c-ns-resize', iconSize: [10, 10]}),
        iconEWResize = L.divIcon({className: 'circle c-ew-resize', iconSize: [10, 10]}),
        iconNESWResize = L.divIcon({className: 'circle c-nesw-resize', iconSize: [10, 10]}),
        iconNWSEesize = L.divIcon({className: 'circle c-nwse-resize', iconSize: [10, 10]})
    this.__northeast = L.marker(this.__bounds.getNorthEast(), {icon: iconNESWResize, draggable: true})
    this.__southeast = L.marker(this.__bounds.getSouthEast(), {icon: iconNWSEesize, draggable: true})
    this.__southwest = L.marker(this.__bounds.getSouthWest(), {icon: iconNESWResize, draggable: true})
    this.__northwest = L.marker(this.__bounds.getNorthWest(), {icon: iconNWSEesize, draggable: true})
    this.__northeast.on('drag', this._updateNorthEast, this)
    this.__southeast.on('drag', this._updateSouthEast, this)
    this.__southwest.on('drag', this._updateSouthWest, this)
    this.__northwest.on('drag', this._updateNorthWest, this)
    this.__rectangle.on('mousedown', this._dragRectangle, this)
    this.dragEnabled = false
  }

  on (eventName, callback) {
    if (!this.__customEvents[eventName])
      this.__customEvents[eventName] = []
    this.__customEvents[eventName].push(callback)
    return this
  }

  trigger (eventName, arg) {
    if (this.__customEvents[eventName] !== undefined) {
      this.__customEvents[eventName].forEach(function(callback) {
        callback(arg)
      })
    }
    return this
  }

  addTo (map) {
    this.__rectangle.addTo(map)
    this.__northeast.addTo(map)
    this.__southeast.addTo(map)
    this.__southwest.addTo(map)
    this.__northwest.addTo(map)
    this.__map = map
    this.__map.on('mousemove', this._moveAll, this)
    return this
  }

  _moveAll (overEvent) {
    if (!this.dragEnabled) {
      return
    }
    let mouseloc = overEvent.latlng,
        center = this.__bounds.getCenter()
    let delta_x = mouseloc.lng - center.lng,
        delta_y = mouseloc.lat - center.lat
    this.__bounds = L.latLngBounds(
      [this.__bounds.getSouth() + delta_y,
       this.__bounds.getWest() + delta_x],
      [this.__bounds.getNorth() + delta_y,
       this.__bounds.getEast() + delta_x])
    this._updateAll()
  }

  _dragRectangle (e) {
    this.__map.dragging.disable()
    this.dragEnabled = true
    this.__map.once('mouseup', () => {
      this.__map.dragging.enable()
      this.dragEnabled = false
    })
  }

  getBounds () {
    return this.__bounds
  }

  setBounds (bounds) {
    this.__bounds = L.latLngBounds(bounds[0], bounds[1])
    this._updateAll()
  }

  getCenter () {
    return this.__bounds.getCenter()
  }

  _updateAll () {
    this.__northeast.setLatLng(this.__bounds.getNorthEast())
    this.__southeast.setLatLng(this.__bounds.getSouthEast())
    this.__southwest.setLatLng(this.__bounds.getSouthWest())
    this.__northwest.setLatLng(this.__bounds.getNorthWest())
    this.__rectangle.setBounds(this.__bounds)
    this.trigger('boundschange', this)
  }

  _updateNorthEast () {
    this.__bounds = L.latLngBounds(this.__bounds.getSouthWest(), this.__northeast.getLatLng())
    this._updateAll()
  }

  _updateSouthEast () {
    let southeast = this.__southeast.getLatLng()
    this.__bounds = L.latLngBounds([southeast.lat, this.__bounds.getWest()], [this.__bounds.getNorth(), southeast.lng])
    this._updateAll()
  }

  _updateSouthWest () {
    this.__bounds = L.latLngBounds(this.__southwest.getLatLng(), this.__bounds.getNorthEast())
    this._updateAll()
  }

  _updateNorthWest () {
    let northwest = this.__northwest.getLatLng()
    this.__bounds = L.latLngBounds([this.__bounds.getSouth(), northwest.lng], [northwest.lat, this.__bounds.getEast()])
    this._updateAll()
  }
}
