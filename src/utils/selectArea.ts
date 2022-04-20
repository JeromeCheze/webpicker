import L from 'leaflet'

export default class SelectArea {
  __customEvents: Record<string, Array<(arg: any) => void>>;
  __bounds: L.LatLngBounds;
  __rectangle: L.Rectangle;
  __north: L.Marker;
  __northeast: L.Marker;
  __east: L.Marker;
  __southeast: L.Marker;
  __south: L.Marker;
  __southwest: L.Marker;
  __west: L.Marker;
  __northwest: L.Marker;
  __map: L.Map|null;

  constructor (bounds: L.LatLngTuple[]) {
    this.__customEvents = {}
    const latmin = bounds[0][0]
    const lonmin = bounds[0][1]
    const latmax = bounds[1][0]
    const lonmax = bounds[1][1]
    this.__map = null
    this.__bounds = L.latLngBounds(bounds[0], bounds[1])
    this.__rectangle = L.rectangle(this.__bounds, {
      stroke: true,
      color: 'black',
      weight: 2,
      opacity: 1,
      fill: true,
      fillColor: 'black',
      fillOpacity: 0.1,
      interactive: true,
      bubblingMouseEvents: false
    })
    const iconNSResize = L.divIcon({ className: 'circle c-ns-resize', iconSize: [10, 10] })
    const iconEWResize = L.divIcon({ className: 'circle c-ew-resize', iconSize: [10, 10] })
    const iconNESWResize = L.divIcon({ className: 'circle c-nesw-resize', iconSize: [10, 10] })
    const iconNWSEesize = L.divIcon({ className: 'circle c-nwse-resize', iconSize: [10, 10] })
    this.__north = L.marker([latmax, this.__bounds.getCenter().lng], { icon: iconNSResize, draggable: true })
    this.__northeast = L.marker(this.__bounds.getNorthEast(), { icon: iconNESWResize, draggable: true })
    this.__east = L.marker([this.__bounds.getCenter().lat, lonmax], { icon: iconEWResize, draggable: true })
    this.__southeast = L.marker(this.__bounds.getSouthEast(), { icon: iconNWSEesize, draggable: true })
    this.__south = L.marker([latmin, this.__bounds.getCenter().lng], { icon: iconNSResize, draggable: true })
    this.__southwest = L.marker(this.__bounds.getSouthWest(), { icon: iconNESWResize, draggable: true })
    this.__west = L.marker([this.__bounds.getCenter().lat, lonmin], { icon: iconEWResize, draggable: true })
    this.__northwest = L.marker(this.__bounds.getNorthWest(), { icon: iconNWSEesize, draggable: true })
    this.__north.on('drag', this._updateNorth, this)
    this.__northeast.on('drag', this._updateNorthEast, this)
    this.__east.on('drag', this._updateEast, this)
    this.__southeast.on('drag', this._updateSouthEast, this)
    this.__south.on('drag', this._updateSouth, this)
    this.__southwest.on('drag', this._updateSouthWest, this)
    this.__west.on('drag', this._updateWest, this)
    this.__northwest.on('drag', this._updateNorthWest, this)
    this.__rectangle.on('mousedown', this._dragRectangle, this)
  }

  on (eventName: string, callback: (arg: any) => void) {
    if (!this.__customEvents[eventName]) {
      this.__customEvents[eventName] = []
    }
    this.__customEvents[eventName].push(callback)
    return this
  }

  trigger (eventName: string, arg: any) {
    if (this.__customEvents[eventName] !== undefined) {
      for (const callback of this.__customEvents[eventName]) {
        callback(arg)
      }
    }
    return this
  }

  addTo (map: L.Map) {
    this.__rectangle.addTo(map)
    this.__north.addTo(map)
    this.__northeast.addTo(map)
    this.__east.addTo(map)
    this.__southeast.addTo(map)
    this.__south.addTo(map)
    this.__southwest.addTo(map)
    this.__west.addTo(map)
    this.__northwest.addTo(map)
    this.__map = map
    return this
  }

  _moveAll (overEvent: L.LeafletMouseEvent) {
    const mouseloc = overEvent.latlng
    const center = this.__bounds.getCenter()
    const deltaX = mouseloc.lng - center.lng
    const deltaY = mouseloc.lat - center.lat
    this.__bounds = L.latLngBounds(
      [this.__bounds.getSouth() + deltaY, this.__bounds.getWest() + deltaX],
      [this.__bounds.getNorth() + deltaY, this.__bounds.getEast() + deltaX]
    )
    this._updateAll()
  }

  _dragRectangle () {
    if (this.__map == null) {
      return
    }
    this.__map.dragging.disable()
    this.__map.on('mousemove', this._moveAll, this)
    this.__map.once('mouseup', () => {
      if (this.__map == null) {
        return
      }
      this.__map.off('mousemove', this._moveAll, this)
      this.__map.dragging.enable()
    })
  }

  getBounds () {
    const b = this.__bounds
    return [
      [b.getSouth(), b.getWest()],
      [b.getNorth(), b.getEast()]
    ]
  }

  setBounds (bounds: L.LatLngTuple[]) {
    this.__bounds = L.latLngBounds(bounds[0], bounds[1])
    this._updateAll()
  }

  getCenter () {
    return this.__bounds.getCenter()
  }

  _updateAll () {
    this.__north.setLatLng([this.__bounds.getNorth(), this.__bounds.getCenter().lng])
    this.__northeast.setLatLng(this.__bounds.getNorthEast())
    this.__east.setLatLng([this.__bounds.getCenter().lat, this.__bounds.getEast()])
    this.__southeast.setLatLng(this.__bounds.getSouthEast())
    this.__south.setLatLng([this.__bounds.getSouth(), this.__bounds.getCenter().lng])
    this.__southwest.setLatLng(this.__bounds.getSouthWest())
    this.__west.setLatLng([this.__bounds.getCenter().lat, this.__bounds.getWest()])
    this.__northwest.setLatLng(this.__bounds.getNorthWest())
    this.__rectangle.setBounds(this.__bounds)
    this.trigger('boundschange', this)
  }

  _updateNorth () {
    const latmax = this.__north.getLatLng().lat
    this.__bounds = L.latLngBounds(this.__bounds.getSouthWest(), [latmax, this.__bounds.getEast()])
    this._updateAll()
  }

  _updateNorthEast () {
    this.__bounds = L.latLngBounds(this.__bounds.getSouthWest(), this.__northeast.getLatLng())
    this._updateAll()
  }

  _updateEast () {
    const lonmax = this.__east.getLatLng().lng
    this.__bounds = L.latLngBounds(this.__bounds.getSouthWest(), [this.__bounds.getNorth(), lonmax])
    this._updateAll()
  }

  _updateSouthEast () {
    const southeast = this.__southeast.getLatLng()
    this.__bounds = L.latLngBounds([southeast.lat, this.__bounds.getWest()], [this.__bounds.getNorth(), southeast.lng])
    this._updateAll()
  }

  _updateSouth () {
    const latmin = this.__south.getLatLng().lat
    this.__bounds = L.latLngBounds([latmin, this.__bounds.getWest()], this.__bounds.getNorthEast())
    this._updateAll()
  }

  _updateSouthWest () {
    this.__bounds = L.latLngBounds(this.__southwest.getLatLng(), this.__bounds.getNorthEast())
    this._updateAll()
  }

  _updateWest () {
    const lonmin = this.__west.getLatLng().lng
    this.__bounds = L.latLngBounds([this.__bounds.getSouth(), lonmin], this.__bounds.getNorthEast())
    this._updateAll()
  }

  _updateNorthWest () {
    const northwest = this.__northwest.getLatLng()
    this.__bounds = L.latLngBounds([this.__bounds.getSouth(), northwest.lng], [northwest.lat, this.__bounds.getEast()])
    this._updateAll()
  }
}
