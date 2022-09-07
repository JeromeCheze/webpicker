/* eslint-disable indent,semi */
/**
 *  Create a Canvas as ImageOverlay to draw the Lat/Lon Graticule,
 *  and show the axis tick label on the edge of the map.
 *  Author: lanwei@cloudybay.com.tw
 */

import L from 'leaflet'

export default L.Layer.extend({
  includes: L.Evented.prototype,
  options: {
    showLabel: true,
    opacity: 1,
    weight: 0.8,
    color: '#888888',
    font: '14px Verdana',
    dashArray: [1, 1],
    lngLineCurved: 0,
    latLineCurved: 0,
    zoomInterval: [
      { start: 2, end: 2, interval: 40 },
      { start: 3, end: 3, interval: 20 },
      { start: 4, end: 4, interval: 10 },
      { start: 5, end: 6, interval: 5 },
      { start: 7, end: 7, interval: 2.5 },
      { start: 8, end: 9, interval: 1 },
      { start: 10, end: 11, interval: 0.5 },
      { start: 12, end: 20, interval: 0.25 }
    ],
    sides: ['N', 'S', 'E', 'W']
  },

  initialize (options: L.LayerOptions) {
    L.setOptions(this, options)

    const defaultFontName = 'Verdana'
    const _ff = this.options.font.split(' ')
    if (_ff.length < 2) {
      this.options.font += ' ' + defaultFontName
    }

    if (!this.options.fontColor) {
      this.options.fontColor = this.options.color
    }

    if (this.options.zoomInterval) {
      if (this.options.zoomInterval.latitude) {
        this.options.latInterval = this.options.zoomInterval.latitude
        if (!this.options.zoomInterval.longitude) {
          this.options.lngInterval = this.options.zoomInterval.latitude
        }
      }
      if (this.options.zoomInterval.longitude) {
        this.options.lngInterval = this.options.zoomInterval.longitude
        if (!this.options.zoomInterval.latitude) {
          this.options.latInterval = this.options.zoomInterval.longitude
        }
      }
      if (!this.options.latInterval) {
        this.options.latInterval = this.options.zoomInterval
      }
      if (!this.options.lngInterval) {
        this.options.lngInterval = this.options.zoomInterval
      }
    }
  },

  onAdd (map: L.Map) {
    this._map = map

    if (!this._canvas) {
      this._initCanvas()
    }

    map.getPane('overlayPane')!.appendChild(this._canvas)

    map.on('viewreset', this._reset, this)
    map.on('move', this._reset, this)
    map.on('moveend', this._reset, this)

    if (map.options.zoomAnimation && L.Browser.any3d) {
      map.on('zoomanim', this._animateZoom, this)
    }

    this._reset()
  },

  onRemove (map: L.Map) {
    L.DomUtil.remove(this._canvas)

    map.off('viewreset', this._reset, this)
    map.off('move', this._reset, this)
    map.off('moveend', this._reset, this)

    if (map.options.zoomAnimation) {
      map.off('zoomanim', this._animateZoom, this)
    }
  },

  addTo (map: L.Map) {
    map.addLayer(this)
    return this
  },

  setOpacity (opacity: number) {
    this.options.opacity = opacity
    this._updateOpacity()
    return this
  },

  bringToFront () {
    return this
  },

  bringToBack () {
    return this
  },

  getAttribution () {
    return this.options.attribution
  },

  _initCanvas () {
    this._canvas = L.DomUtil.create('canvas', '')

    if (this._map.options.zoomAnimation && L.Browser.any3d) {
      L.DomUtil.addClass(this._canvas, 'leaflet-zoom-animated')
    } else {
      L.DomUtil.addClass(this._canvas, 'leaflet-zoom-hide')
    }

    this._updateOpacity()

    L.extend(this._canvas, {
      onselectstart: L.Util.falseFn,
      onmousemove: L.Util.falseFn,
      onload: L.bind(this._onCanvasLoad, this)
    })
  },

  _animateZoom (e: L.ZoomAnimEvent) {
    const map = this._map
    const canvas = this._canvas
    const scale = map.getZoomScale(e.zoom)
    const nw = map.containerPointToLatLng([0, 0])
    const se = map.containerPointToLatLng([canvas.width, canvas.height])
    const topLeft = map._latLngToNewLayerPoint(nw, e.zoom, e.center)
    const size = map._latLngToNewLayerPoint(se, e.zoom, e.center)._subtract(topLeft)
    const origin = topLeft._add(size._multiplyBy((1 / 2) * (1 - 1 / scale)))
    L.DomUtil.setTransform(canvas, origin, scale)
  },

  _reset () {
    const canvas = this._canvas
    const size = this._map.getSize()
    const lt = this._map.containerPointToLayerPoint([0, 0])

    L.DomUtil.setPosition(canvas, lt)

    canvas.width = size.x
    canvas.height = size.y
    canvas.style.width = size.x + 'px'
    canvas.style.height = size.y + 'px'

    this.__calcInterval()

    this.__draw(true)
  },

  _onCanvasLoad () {
    this.fire('load')
  },

  _updateOpacity () {
    L.DomUtil.setOpacity(this._canvas, this.options.opacity)
  },

  __format_lat (lat: number) {
      if (this.options.latFormatTickLabel) {
        return this.options.latFormatTickLabel(lat)
      }

      // todo: format type of float
      if (lat < 0) {
        return '' + (lat * -1) + this.options.sides[1]
      } else if (lat > 0) {
        return '' + lat + this.options.sides[0]
      }
      return '' + lat
  },

  __format_lng (lng: number) {
      if (this.options.lngFormatTickLabel) {
        return this.options.lngFormatTickLabel(lng)
      }

      // todo: format type of float
      if (lng > 180) {
        return '' + (360 - lng) + this.options.sides[3]
      } else if (lng > 0 && lng < 180) {
        return '' + lng + this.options.sides[2]
      } else if (lng < 0 && lng > -180) {
        return '' + (lng * -1) + this.options.sides[3]
      } else if (lng === -180) {
        return '' + (lng * -1)
      } else if (lng < -180) {
        return '' + (360 + lng) + this.options.sides[3]
      }
      return '' + lng
  },

  __calcInterval () {
    const zoom = this._map.getZoom()
    if (this._currZoom !== zoom) {
      this._currLngInterval = 0
      this._currLatInterval = 0
      this._currZoom = zoom
    }

    if (!this._currLngInterval) {
      try {
        for (const idx in this.options.lngInterval) {
          const dict = this.options.lngInterval[idx]
          if (dict.start <= zoom) {
            if (dict.end && dict.end >= zoom) {
              this._currLngInterval = dict.interval
              break
            }
          }
        }
      } catch (e) {
        this._currLngInterval = 0
      }
    }

    if (!this._currLatInterval) {
      try {
        for (const idx in this.options.latInterval) {
          const dict = this.options.latInterval[idx]
          if (dict.start <= zoom) {
            if (dict.end && dict.end >= zoom) {
              this._currLatInterval = dict.interval
              break
            }
          }
        }
      } catch (e) {
        this._currLatInterval = 0
      }
    }
  },

  __draw (label: boolean) {
    const _parsePxToInt = (txt: string) => {
        if (txt.length > 2) {
            if (txt.charAt(txt.length - 2) === 'p') {
                txt = txt.slice(0, txt.length - 2)
            }
        }
        try {
            return parseInt(txt, 10)
        } catch (e) {}
        return 0
    }

    const canvas = this._canvas
    const map = this._map as L.Map
    const curvedLon = this.options.lngLineCurved
    const curvedLat = this.options.latLineCurved

    if (L.Browser.canvas && map) {
      if (!this._currLngInterval || !this._currLatInterval) {
        this.__calcInterval()
      }

      const latInterval = this._currLatInterval
      const lngInterval = this._currLngInterval

      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.lineWidth = this.options.weight
      ctx.strokeStyle = this.options.color
      ctx.fillStyle = this.options.fontColor
      ctx.setLineDash(this.options.dashArray)

      if (this.options.font) {
        ctx.font = this.options.font
      }
      let txtHeight = 12
      try {
        const _fontSize = ctx.font.trim().split(' ')[0]
        txtHeight = _parsePxToInt(_fontSize)
      } catch (e) {}

      const ww = canvas.width
      const hh = canvas.height

      const lt = map.containerPointToLatLng(L.point(0, 0))
      const rt = map.containerPointToLatLng(L.point(ww, 0))
      const rb = map.containerPointToLatLng(L.point(ww, hh))

      let _latB = rb.lat
      let _latT = lt.lat
      let _latL = lt.lng
      let _latR = rt.lng

      let _pointPerLat = (_latT - _latB) / (hh * 0.2)
      if (isNaN(_pointPerLat)) {
        return
      }

      if (_pointPerLat < 1) {
        _pointPerLat = 1
      }
      if (_latB < -90) {
        _latB = -90
      } else {
          _latB = parseInt(`${_latB - _pointPerLat}`, 10)
      }

      if (_latT > 90) {
        _latT = 90
      } else {
        _latT = parseInt(`${_latT + _pointPerLat}`, 10)
      }

      let _pointPerLon = (_latR - _latL) / (ww * 0.2)
      if (_pointPerLon < 1) {
        _pointPerLon = 1
      }
      if (_latL > 0 && _latR < 0) {
        _latR += 360
      }
      _latR = parseInt(`${_latR + _pointPerLon}`, 10)
      _latL = parseInt(`${_latL - _pointPerLon}`, 10)

      const __drawLatLone = (latTick: number) => {
        let _lonDelta = 0.5
        let ll = this._latLngToCanvasPoint(L.latLng(latTick, _latL))
        const latstr = this.__format_lat(latTick)
        const txtWidth = ctx.measureText(latstr).width
        const spacer = this.options.showLabel && label ? txtWidth + 10 : 0

        if (curvedLat) {
          if (typeof (curvedLat) === 'number') {
            _lonDelta = curvedLat
          }

          let __latLeft = _latL
          let __latRight = _latR
          if (ll.x > 0) {
            const posX = map.containerPointToLatLng(L.point(0, ll.y))
            __latLeft = posX.lng - _pointPerLon
            ll.x = 0
          }
          let rr = this._latLngToCanvasPoint(L.latLng(latTick, __latRight))
          if (rr.x < ww) {
            const posY = map.containerPointToLatLng(L.point(ww, rr.y))
            __latRight = posY.lng + _pointPerLon
            if (__latLeft > 0 && __latRight < 0) {
              __latRight += 360
            }
          }

          ctx.beginPath()
          ctx.moveTo(ll.x + spacer, ll.y)
          let _prevP = null as {[index: string]: number} | null
          for (let j = __latLeft; j <= __latRight; j += _lonDelta) {
            rr = this._latLngToCanvasPoint(L.latLng(latTick, j))
            ctx.lineTo(rr.x - spacer, rr.y)

            if (this.options.showLabel && label && _prevP != null) {
              if (_prevP.x < 0 && rr.x >= 0) {
                const _s = (rr.x - 0) / (rr.x - _prevP.x)
                const _y = rr.y - ((rr.y - _prevP.y) * _s)
                ctx.fillText(latstr, 0, _y + (txtHeight / 2))
              } else if (_prevP.x <= (ww - txtWidth) && rr.x > (ww - txtWidth)) {
                const _s = (rr.x - ww) / (rr.x - _prevP.x)
                const _y = rr.y - ((rr.y - _prevP.y) * _s)
                ctx.fillText(latstr, ww - txtWidth, _y + (txtHeight / 2) - 2)
              }
            }

            _prevP = { x: rr.x, y: rr.y, lon: j, lat: latTick }
          }
          ctx.stroke()
        } else {
          let __latRight = _latR
          let rr = this._latLngToCanvasPoint(L.latLng(latTick, __latRight))
          if (curvedLon) {
            __latRight = map.containerPointToLatLng(L.point(0, rr.y)).lng
            rr = this._latLngToCanvasPoint(L.latLng(latTick, __latRight))

            const __latLeft = map.containerPointToLatLng(L.point(ww, rr.y)).lng
            ll = this._latLngToCanvasPoint(L.latLng(latTick, __latLeft))
          }

          ctx.beginPath()
          ctx.moveTo(1 + spacer, ll.y)
          ctx.lineTo(rr.x - 1 - spacer, rr.y)
          ctx.stroke()
          if (this.options.showLabel && label) {
            const _yy = ll.y + (txtHeight / 2) - 2
            ctx.fillText(latstr, 0, _yy)
            ctx.fillText(latstr, ww - txtWidth, _yy)
          }
        }
      }

      if (latInterval > 0) {
        for (let i = latInterval; i <= _latT; i += latInterval) {
          if (i >= _latB) {
            __drawLatLone(i)
          }
        }
        for (let i = 0; i >= _latB; i -= latInterval) {
          if (i <= _latT) {
            __drawLatLone(i)
          }
        }
      }

      const __drawLonLine = (lonTick: number) => {
        let _lonDelta = 0.5
        const lngstr = this.__format_lng(lonTick)
        const txtWidth = ctx.measureText(lngstr).width
        let bb = this._latLngToCanvasPoint(L.latLng(_latB, lonTick))
        const spacer = this.options.showLabel && label ? txtHeight + 5 : 0

        if (curvedLon) {
          if (typeof (curvedLon) === 'number') {
            _lonDelta = curvedLon
          }

          ctx.beginPath()
          ctx.moveTo(bb.x, 5 + spacer)
          let _prevP = null as {[index: string]: number} | null
          for (let j = _latB; j < _latT; j += _lonDelta) {
            const tt = this._latLngToCanvasPoint(L.latLng(j, lonTick))
            ctx.lineTo(tt.x, tt.y - spacer)

            if (this.options.showLabel && label && _prevP != null) {
              if (_prevP.y > 8 && tt.y <= 8) {
                ctx.fillText(lngstr, tt.x - (txtWidth / 2), txtHeight + 5)
              } else if (_prevP.y >= hh && tt.y < hh) {
                ctx.fillText(lngstr, tt.x - (txtWidth / 2), hh - 2)
              }
            }

            _prevP = { x: tt.x, y: tt.y, lon: lonTick, lat: j }
          }
          ctx.stroke()
        } else {
          let __latTop = _latT
          let tt = this._latLngToCanvasPoint(L.latLng(__latTop, lonTick))
          if (curvedLat) {
            __latTop = map.containerPointToLatLng(L.point(tt.x, 0)).lat
            if (__latTop > 90) {
              __latTop = 90
            }
            tt = this._latLngToCanvasPoint(L.latLng(__latTop, lonTick))

            let __latBottom = map.containerPointToLatLng(L.point(bb.x, hh)).lat
            if (__latBottom < -90) {
              __latBottom = -90
            }
            bb = this._latLngToCanvasPoint(L.latLng(__latBottom, lonTick))
          }

          ctx.beginPath()
          ctx.moveTo(tt.x, 5 + spacer)
          ctx.lineTo(bb.x, hh - 1 - spacer)
          ctx.stroke()

          if (this.options.showLabel && label) {
            ctx.fillText(lngstr, tt.x - (txtWidth / 2), txtHeight + 5)
            ctx.fillText(lngstr, bb.x - (txtWidth / 2), hh - 3)
          }
        }
      }

      if (lngInterval > 0) {
        for (let i = lngInterval; i <= _latR; i += lngInterval) {
          if (i >= _latL) {
            __drawLonLine(i)
          }
        }
        for (let i = 0; i >= _latL; i -= lngInterval) {
          if (i <= _latR) {
            __drawLonLine(i)
          }
        }
      }
    }
  },

  _latLngToCanvasPoint (latlng: L.LatLng) {
    const map = this._map
    const projectedPoint = map.project(L.latLng(latlng))
    projectedPoint._subtract(map.getPixelOrigin())
    return L.point(projectedPoint).add(map._getMapPanePos())
  }

})
