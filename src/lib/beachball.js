export default class BeachballEngine {
  constructor (boxSize, nbPoint, pointSize, wasmURI) {
    this.boxSize = boxSize
    this.nbPoint = nbPoint
    this.pointSize = pointSize
    this.wasmURI = wasmURI
    this.module = null
    this.ctx = null
    this.radius = null
    this.center = (this.boxSize + this.pointSize) / 2
  }

  init () {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = this.boxSize
      this.ctx = canvas.getContext('2d')
      const importObject = {
        env: {
          abort(_msg, _file, line, column) {
            console.error("abort called at index.ts:" + line + ":" + column);
          }
        }
      }
      WebAssembly.instantiateStreaming(fetch(this.wasmURI), importObject).then(wasmModule => {
        this.module = wasmModule
        const { setBoxSize, init } = wasmModule.instance.exports
        setBoxSize(this.boxSize)
        init(this.nbPoint)
        resolve()
      })
    })
  }

  drawFocal(s, d, r, c='blue') {
    this.ctx.clearRect(0, 0, this.boxSize, this.boxSize)
    const { setFocal, getResult } = this.module.instance.exports
    const l = setFocal(s, d, r)
    this.radius = getResult(0)
    this.ctx.strokeStyle = 'black'
    this.ctx.fillStyle = 'white'
    this.ctx.beginPath()
    this.ctx.arc(this.center, this.center, this.radius, 0, 2 * Math.PI)
    this.ctx.fill()
    this.ctx.fillStyle = c
    for (let i = 1; i < l; i++) {
      let x = getResult(i)
      if (x === 0) {
        this.ctx.fillStyle = 'black'
        continue
      }
      let y = getResult(++i)
      this.ctx.fillRect(x, y, this.pointSize, this.pointSize)
    }
    this.ctx.beginPath()
    this.ctx.arc(this.center, this.center, this.radius, 0, 2 * Math.PI)
    this.ctx.stroke()
  }

  getFocalImage (s, d, r, c='blue') {
    this.drawFocal(s, d, r, c)
    return this.ctx.canvas.toDataURL()
  }
}