export default class BeachballEngine {
  boxSize: number
  nbPoint: number
  pointSize: number
  wasmURI: string
  module: WebAssembly.WebAssemblyInstantiatedSource | null
  ctx: CanvasRenderingContext2D | null
  radius: number | null
  center: number

  constructor (boxSize: number, nbPoint: number, pointSize: number, wasmURI: string) {
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
    return new Promise((resolve: Function) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = this.boxSize
      this.ctx = canvas.getContext('2d')
      const importObject: WebAssembly.Imports = {
        env: {
          abort (_msg: string, _file: string, line: number, column: number) {
            console.error('abort called at index.ts:' + line + ':' + column)
          }
        }
      }
      WebAssembly.instantiateStreaming(fetch(this.wasmURI), importObject).then(wasmModule => {
        this.module = wasmModule
        const { setBoxSize, init } = wasmModule.instance.exports as {[index: string]: Function}
        setBoxSize(this.boxSize)
        init(this.nbPoint)
        resolve()
      })
    })
  }

  drawFocal (s: number, d: number, r: number, c = 'blue') {
    if (this.ctx == null) {
      return
    }
    this.ctx.clearRect(0, 0, this.boxSize, this.boxSize)
    const { setFocal, getResult } = this.module!.instance.exports as {[index: string]: Function}
    const l = setFocal(s, d, r)
    this.radius = getResult(0) as number
    this.ctx.strokeStyle = 'black'
    this.ctx.fillStyle = 'white'
    this.ctx.beginPath()
    this.ctx.arc(this.center, this.center, this.radius, 0, 2 * Math.PI)
    this.ctx.fill()
    this.ctx.fillStyle = c
    for (let i = 1; i < l; i++) {
      const x = getResult(i)
      if (x === 0) {
        this.ctx.fillStyle = 'black'
        continue
      }
      const y = getResult(++i)
      this.ctx.fillRect(x, y, this.pointSize, this.pointSize)
    }
    this.ctx.beginPath()
    this.ctx.arc(this.center, this.center, this.radius, 0, 2 * Math.PI)
    this.ctx.stroke()
  }

  getFocalImage (s: number, d: number, r: number, c = 'blue') {
    this.drawFocal(s, d, r, c)
    return this.ctx!.canvas.toDataURL()
  }
}
