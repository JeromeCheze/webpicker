import { StringIndexedObject, WebpickerCreationInfo } from '@/types'

export type WaveformPick = {
  id: string | null;
  phase: string;
  weight: number;
  mode: string;
  time: number;
  residual: number;
  takeoff?: number;
  filter?: string;
  polarity: string | null;
  'creation_info'?: WebpickerCreationInfo;
  'upper_uncertainty': number | null;
  'lower_uncertainty': number | null;
}

export type PickEvent = {
  action: string;
  wfid: string;
  picks: WaveformPick[];
}

export type WaveformItemOptions = {
  start: number;
  step: number;
  values: (number | null)[];
  filtered?: (number | null)[];
  scale: number;
  id: string;
  distance: number;
  azimuth: number;
  ttt: {
    [index: string]: number;
  };
  picks: WaveformPick[];
}

type WaveformStats = {
  min: number | null;
  max: number | null;
  sum: number;
  count: number;
  avg: number | null;
  sqSum?: number;
  amp: number | null;
}

type WaveformDrawOptions = {
  scaleGain: number;
  step: number;
  x0: number;
  yRatio: number;
}

export type WaveformItem = {
  opt: WaveformItemOptions;
  el?: HTMLElement;
  ctx?: CanvasRenderingContext2D;
  ctx2?: CanvasRenderingContext2D;
  ctx3?: CanvasRenderingContext2D;
  stats?: WaveformStats;
  drawOpt?: WaveformDrawOptions;
  groupedValues?: ([number, number] | null)[] | null;
}

type EventHandlerItem = {
 type: string;
 el: HTMLElement;
 callback: (ev: any) => void;
}

type WaveformEvent = {
  pickLineTime: number | null;
  handlers: EventHandlerItem[];
  xOffset: number;
  moved: boolean;
  clickPos: number | null;
  useFiltered: boolean;
  wheelDelta: number | null;
  selectedWf: WaveformItem | null;
  selectedPicks: WaveformPick[];
  hoverPick: WaveformPick | null;
  hoverPickTimeout: number | null;
  hoverWf: WaveformItem | null;
  phase: string | null;
  x: number | null;
}

export interface WaveformColorOptions extends StringIndexedObject {
  // global
  amplitudeValue: string;
  background: string;
  backgroundEven: string;
  grid: string;
  selected: string;
  selectedWindow: string;
  border: string;
  text: string;
  // label
  labelBackground: string;
  labelText: string;
  // line
  line: string;
  avgLine: string;
  lineBar: string;
  // phases
  theoretical: string;
  automatic: string;
  manual: string;
  uncertainty: string;
}

export type WaveformOptions = {
  /* required */
  container: string | HTMLElement;
  mode: 'list' | 'picker';
  waveforms : WaveformItemOptions[];
  /* optional */
  // -- style --
  size?: {
    height: number;
    wrapperMaxHeight?: number;
    width?: number | null;
    font?: number;
  };
  color?: WaveformColorOptions,
  callback?: {
    waveformClick?: null | ((wf: WaveformItemOptions) => void);
    updatePick?: null | ((pe: PickEvent) => void);
    draw?: null | ((tw: {start: number, end: number}) => void);
    waveformFocus?: null | ((index: number) => void);
  },
  view?: {
    refTime?: string;
    duration?: number | null;
    offset?: number | null;
    gain?: number;
  },
  equalScale: boolean;
}

export class Waveform {
  xGridScales: number[];
  waveforms: WaveformItem[];
  event: WaveformEvent;
  displayedWaveforms: WaveformItem[];
  opt: {[index: string]: any};
  view: {[index: string]: any};
  mainElement: HTMLElement | null;
  xAxis: CanvasRenderingContext2D | null;

  constructor (opt: WaveformOptions) {
    this.xGridScales = [
      31536000000, 15768000000, // >/= 6 months
      4838400000, 2419200000, 604800000, // >/= 7days
      172800000, 86400000, // >/= 1 day
      43200000, 21600000, 14400000, 7200000, 3600000, // >/= 1 hour
      1800000, 600000, 300000, 120000, 60000, // >/= 1 minute
      30000, 10000, 5000, 2000, 1000, // >/= 1 seconde
      500, 200, 100, // < 1 seconde
      50, 20, 10 // < 100 ms
    ]
    this.waveforms = []
    this.event = {
      pickLineTime: null,
      handlers: [],
      xOffset: 0,
      moved: false,
      clickPos: null,
      useFiltered: false,
      wheelDelta: null,
      selectedWf: null,
      selectedPicks: [],
      hoverPick: null,
      hoverPickTimeout: null,
      hoverWf: null,
      phase: null,
      x: null
    }
    this.view = {}
    this.opt = {}
    this.mainElement = null
    this.xAxis = null
    this.displayedWaveforms = []
    this.loadOptions(opt)
    this.getDisplayedWaveforms(true)
    this.initStructure()
    if (this.displayedWaveforms.length > 0) {
      this.draw()
    }
  }

  loadOptions (opt: {[index: string]: any}) {
    // default options
    this.opt = {
      /* required */
      container: null,
      mode: 'list', // 'list' or 'picker'
      waveforms: [], /* [
        {
          start: <js_timestamp>,
          step: <number>,
          values: [],
          filtered: [],
          scale: <channel_global_sensitivity>,
          id: 'XX.NOISE.00.HHZ',
          distance: <number>,
          ttt: {P: <js_timestamp>}, // ttt = "theoretical travel time"
          picks: [{
            phase: 'P',
            weight: <int>,
            mode: 'manual',
            time: <js_timestamp>,
            residual: <seconds>,
            polarity: null || 'positive' || 'negative'
          }]
        }
      ] */
      /* optional */
      // -- style --
      size: {
        height: 50, // the height of a single waveform
        wrapperMaxHeight: 400, // trace container max height
        width: null,
        font: 10
      },
      color: {
        // global
        amplitudeValue: 'gray',
        background: 'white',
        backgroundEven: '#e5eef1',
        grid: 'rgba(180,180,180,.3)',
        selected: '#c9e8f9',
        selectedWindow: 'rgba(0, 0, 0, 0.2)',
        border: 'black',
        text: 'black',
        // label
        labelBackground: 'rgba(75, 75, 75, 0.8)',
        labelText: 'white',
        // line
        line: '#9cb9c9',
        avgLine: 'rgba(180,180,180,.3)', // '#a6dfea',
        lineBar: 'black',
        // phases
        theoretical: 'blue',
        automatic: 'red',
        manual: '#1ab11b',
        uncertainty: 'rgba(26, 177, 27, 0.2)'
      },
      callback: {
        waveformClick: null,
        updatePick: null,
        draw: null,
        waveformFocus: null
      },
      view: {
        refTime: 'O',
        duration: null,
        offset: null,
        gain: 1
      },
      equalScale: false
    }
    // merge default options with given options
    this.recursiveCopy(this.opt, opt)
    // retrieve a DOMElement if a selector string was given
    if (typeof this.opt.container === 'string') {
      this.opt.container = document.querySelector(this.opt.container)
    }
    // get the width of the container if not given in option
    if (this.opt.size.width === null) {
      const pad = window.getComputedStyle(this.opt.container).padding
      this.opt.size.width = this.opt.container.clientWidth - 2 * parseInt(pad === '' ? '0' : pad)
    }
    this.event.xOffset = this.opt.container.getBoundingClientRect().x
    let start: number | null = null
    let end: number | null = null
    for (const wf of this.opt.waveforms) {
      const currStart = Math.min(wf.start, wf.ttt.O)
      const currEnd = Math.max(wf.start + wf.values.length * wf.step, wf.ttt.O)
      if (start == null || currStart < start) {
        start = currStart
      }
      if (end == null || currEnd > end) {
        end = currEnd
      }
      if (wf.picks == null) {
        wf.picks = []
      }
      wf.scale = wf.scale == null ? 1.0 : wf.scale * 1.0
      this.waveforms.push({ opt: wf })
    }
    this.view = Object.assign({}, this.opt.view)
    if (this.view.duration == null && start != null && end != null) {
      this.view.duration = end - start
    }
    if (this.view.offset == null) {
      this.view.offset = this.view.duration / 2
    }
  }

  initStyle () {
    const styleId = 'waveform-style'
    const styleEl = document.getElementById(styleId)
    if (styleEl != null) {
      styleEl.parentNode!.removeChild(styleEl)
    }
    const s = document.createElement('style')
    s.id = styleId
    s.innerHTML = `
    .trace-container {
      overflow-x: hidden;
      overflow-y: auto;
      border-top: 1px solid ${this.opt.color.border};
    }
    .wf-container {position: relative; background: ${this.opt.color.background};}
    .wf-list .wf-container:nth-child(even) {background: ${this.opt.color.backgroundEven};}
    .wf-list .wf-container.selected {background: ${this.opt.color.selected};}
    .wf-canvas, .user-canvas, .sel-wf-canvas {position: absolute; top: 0; left: 0; z-index: 0;}
    .user-canvas {z-index: 10;}
    .sel-wf-canvas {z-index: 9;}
    .wf-label-container {position: absolute; top: 0; left: 0; background: ${this.opt.color.labelBackground}; z-index: 10; width: 100px;}
    .wf-label {font-family: sans-serif; color: ${this.opt.color.labelText}; font-size: 10px; margin: 5px;}
    .wf-label .distance {font-size: .9em; margin: 10px;}`
    document.head.appendChild(s)
  }

  getWaveformContainer (wf: {[index: string]: any}) {
    if (wf.el != null) {
      return wf.el
    }
    const wfContainer = document.createElement('div')
    const wfCanvas = document.createElement('canvas')
    const userCanvas = document.createElement('canvas')
    const selWfCanvas = document.createElement('canvas')
    const wfLabelContainer = document.createElement('div')
    const wfLabel = document.createElement('div')
    wfContainer.appendChild(wfCanvas)
    wfContainer.appendChild(selWfCanvas)
    wfContainer.appendChild(userCanvas)
    wfContainer.appendChild(wfLabelContainer)
    wfLabelContainer.appendChild(wfLabel)
    wfContainer.className = 'wf-container'
    wfContainer.style.height = `${this.opt.size.height}px`
    wfLabelContainer.style.height = `${this.opt.size.height}px`
    wfLabel.className = 'wf-label'
    wfCanvas.className = 'wf-canvas'
    userCanvas.className = 'user-canvas'
    selWfCanvas.className = 'sel-wf-canvas'
    wfLabelContainer.className = 'wf-label-container'
    wfLabel.innerHTML = `<strong>${wf.opt.id}</strong>`
    if (wf.opt.distance != null) {
      wfLabel.innerHTML += `<br><span class="distance">${wf.opt.distance.toFixed(2)}°</span>`
    }
    wfCanvas.width = this.opt.size.width
    wfCanvas.height = this.opt.size.height
    userCanvas.width = this.opt.size.width
    userCanvas.height = this.opt.size.height
    selWfCanvas.width = this.opt.size.width
    selWfCanvas.height = this.opt.size.height
    wf.ctx = wfCanvas.getContext('2d')
    wf.ctx2 = userCanvas.getContext('2d')
    wf.ctx3 = selWfCanvas.getContext('2d')
    wf.el = wfContainer
    let wfHandlers = [
      { type: 'mouseenter', el: wf.el, callback: (ev: MouseEvent) => this.handleWaveformMouseenter(ev) }
    ]
    if (this.opt.mode === 'picker') {
      wfHandlers = wfHandlers.concat([
        { type: 'mousemove', el: userCanvas, callback: ev => this.handleMouseMove(ev) },
        { type: 'dblclick', el: userCanvas, callback: ev => this.handleDblClick(ev) },
        { type: 'click', el: userCanvas, callback: ev => this.selectPick(ev) }
      ])
    }
    this.event.handlers = this.event.handlers.concat(this.bindEventHandlers(wfHandlers))
    return wfContainer
  }

  initStructure () {
    /*
    mainElement
        |-> traceContainer
        |        |->  wfContainer
        |        :         |-> wfCanvas
        |        :         |-> userCanvas
        |                  \-> wfLabelContainer
        |                             \-> wfLabel
        \-> xAxis
    */
    this.initStyle()
    const mainElement = document.createElement('div')
    const traceContainer = document.createElement('div')
    const xAxis = document.createElement('canvas')
    xAxis.width = this.opt.size.width
    xAxis.height = 40
    mainElement.appendChild(traceContainer)
    mainElement.appendChild(xAxis)
    traceContainer.classList.add('trace-container')
    traceContainer.style.maxHeight = `${this.opt.size.wrapperMaxHeight}px`
    traceContainer.classList.add(this.opt.mode === 'picker' ? 'wf-picker' : 'wf-list')
    for (const wf of this.getDisplayedWaveforms()) {
      const wfContainer = this.getWaveformContainer(wf)
      traceContainer.appendChild(wfContainer)
    }
    this.mainElement = mainElement
    this.xAxis = xAxis.getContext('2d')
    this.opt.container.appendChild(mainElement)
    this.event.handlers = this.event.handlers.concat(this.bindEventHandlers([
      { type: 'wheel', el: mainElement, callback: (ev: WheelEvent) => this.wheelHandler(ev) },
      { type: 'mousedown', el: mainElement, callback: (ev: MouseEvent) => this.mouseDownHandler(ev) },
      { type: 'mousemove', el: mainElement, callback: (ev: MouseEvent) => this.mouseMoveHandler(ev) },
      { type: 'mouseup', el: mainElement, callback: (ev: MouseEvent) => this.mouseUpHandler(ev) }
    ]))
  }

  addWaveforms (wfList: WaveformItemOptions[]) {
    console.log(`[${this.opt.mode}::addWaveforms]`, wfList)
    const traceContainer = this.mainElement!.children[0]
    traceContainer.innerHTML = ''
    let dirty = false
    for (const wfOpt of wfList) {
      if (wfOpt.picks == null) {
        wfOpt.picks = []
      }
      wfOpt.scale = wfOpt.scale == null ? 1.0 : wfOpt.scale * 1.0
      this.waveforms.push({ opt: wfOpt })
    }
    for (const wf of this.getDisplayedWaveforms(true)) {
      const wfContainer = this.getWaveformContainer(wf)
      traceContainer.appendChild(wfContainer)
      const amp = this.computeWaveformStatsAndGroupData(wf)
      if (this.view.maxAmp == null || amp > this.view.maxAmp) {
        this.view.maxAmp = amp
        dirty = true
        continue
      }
      if (!dirty) {
        this.plotWaveform(wf)
      }
    }
    // this.getDisplayedWaveforms(true)
    if (dirty) {
      this.draw()
    }
  }

  /**
   * UTILITIES
   */
  recursiveCopy (obj1: {[index: string]: any}, obj2: {[index: string]: any}) {
    for (const [k, v] of Object.entries(obj2)) {
      if (v instanceof Function) {
        obj1[k] = v
      } else if (v instanceof Object && !(v instanceof Array)) {
        this.recursiveCopy(obj1[k], v)
      } else {
        obj1[k] = v
      }
    }
  }

  setTimeAlignment (ref: string) {
    this.view.refTime = ref
    this.view.offset = ref === 'O' ? this.view.duration / 2 : 0
  }

  getMouseX (ev: MouseEvent) {
    return ev.clientX - this.event.xOffset
  }

  time2index (wf: WaveformItem, t: number) {
    return Math.floor((t - wf.opt.start) / wf.opt.step)
  }

  time2pos (ref: number, t: number) {
    return Math.floor(this.opt.size.width / 2 + (t - ref - this.view.offset) / this.view.xRatio)
  }

  pos2time (ref: number, p: number) {
    return this.view.xRatio * (p - this.opt.size.width / 2) + ref + this.view.offset
  }

  value2pos (wf: WaveformItem, v: number) {
    return Math.floor(this.opt.size.height / 2 -
                      (v - wf.stats!.avg!) *
                        wf.drawOpt!.yRatio *
                        this.view.gain *
                        wf.drawOpt!.scaleGain)
  }

  getXGridStepIndex () {
    let i = 0
    const tickInterval = this.view.duration / (this.opt.size.width / 40) // each ticks must be separated by 40px minimum
    for (; tickInterval < this.xGridScales[i]; i++);
    return i - 1
  }

  getValues (wf: WaveformItem) {
    return (
      this.event.useFiltered === false
        ? wf.opt.values
        : wf.opt.filtered != null ? wf.opt.filtered : []
    )
  }

  /**
   * EVENT HANDLERS
   */
  bindEventHandlers (handlerList: EventHandlerItem[]) {
    for (const e of handlerList) {
      e.el.addEventListener(e.type, e.callback)
    }
    return handlerList
  }

  wheelHandler (ev: WheelEvent) {
    if (ev.shiftKey) {
      ev.preventDefault()
      let delta = (
        Math.abs(ev.deltaY) > 1
          ? ev.deltaY
          : Math.abs(ev.deltaX) > 1
            ? ev.deltaX
            : 0
      )
      if (this.event.wheelDelta == null) {
        this.event.wheelDelta = 0
      }
      this.event.wheelDelta += delta
      if (Math.abs(this.event.wheelDelta) < 5) {
        return
      }
      delta = this.event.wheelDelta
      this.event.wheelDelta = 0
      if (ev.ctrlKey || ev.metaKey) {
        Math.sign(delta) > 0 ? this.yZoomOut() : this.yZoomIn()
      } else {
        Math.sign(delta) > 0 ? this.xZoomOut() : this.xZoomIn()
      }
    }
  }

  mouseDownHandler (ev: MouseEvent) {
    ev.preventDefault()
    this.event.x = this.getMouseX(ev)
    this.event.moved = false
  }

  mouseMoveHandler (ev: MouseEvent) {
    const pos = this.getMouseX(ev)
    this.handleHoverPicks(pos)
    if (this.event.x != null) {
      const delta = this.event.x - pos
      if (Math.abs(delta) > 5) {
        this.event.moved = true
        this.event.x = pos
        const sign = Math.sign(delta)
        const deltaT = Math.abs(delta) * this.view.xRatio
        this.view.offset += deltaT * sign
        this.draw()
      }
    }
  }

  handleHoverPicks (xPos: number) {
    if (this.event.hoverPickTimeout != null) {
      clearTimeout(this.event.hoverPickTimeout)
      this.event.hoverPickTimeout = null
    }
    if (this.event.hoverWf == null) {
      return
    }
    const ref = this.waveforms[0].opt.ttt[this.view.refTime]
    for (const pick of this.event.hoverWf.opt.picks) {
      const pickPos = this.time2pos(ref, pick.time)
      if (Math.abs(pickPos - xPos) < 5) {
        this.event.hoverPick = pick
        this.event.hoverPickTimeout = setTimeout(() => {
          this.drawPickInfo(this.event.hoverPick as WaveformPick)
        }, 200)
        break
      }
    }
  }

  mouseUpHandler (ev: MouseEvent) {
    if (!this.event.moved) {
      if (this.event.hoverWf != null) {
        this.selectWaveform(this.event.hoverWf)
      }
    }
    if (this.event.x != null) {
      this.event.x = null
    }
    this.event.moved = false
  }

  handleWaveformMouseenter (ev: MouseEvent) {
    const wf = this.waveforms.find(x => x.el === ev.target) as WaveformItem
    this.event.hoverWf = wf
    this.applyCallback('waveformFocus', this.waveforms.indexOf(wf))
  }

  handleDblClick (ev: MouseEvent) {
    const ref = this.waveforms[0].opt.ttt[this.view.refTime]
    this.event.pickLineTime = this.pos2time(ref, this.getMouseX(ev))
    this.createPick()
  }

  handleMouseMove (ev: MouseEvent) {
    const ref = this.waveforms[0].opt.ttt[this.view.refTime]
    this.event.pickLineTime = this.pos2time(ref, this.getMouseX(ev))
    this.updatePickLine()
  }

  applyCallback (callbackName: string, arg: any) {
    if (this.opt.callback[callbackName] != null) {
      this.opt.callback[callbackName].call(null, arg)
    }
  }

  /**
   * ACTIONS
   */
  destroy () {
    for (const e of this.event.handlers) {
      e.el.removeEventListener(e.type, e.callback)
    }
    this.mainElement!.parentNode!.removeChild(this.mainElement!)
  }

  getStartTime (wf: WaveformItem) {
    return wf.opt.ttt[this.view.refTime] + this.view.offset - this.view.duration / 2
  }

  getEndTime (wf: WaveformItem) {
    return wf.opt.ttt[this.view.refTime] + this.view.offset + this.view.duration / 2
  }

  setFilterState (state: boolean) {
    this.event.useFiltered = state
    this.draw()
  }

  deleteSelectedPicks () {
    let change = false
    for (const p of this.event.selectedPicks) {
      const i = this.event.hoverWf!.opt.picks.indexOf(p)
      if (i >= 0) {
        change = true
        this.event.hoverWf!.opt.picks.splice(i, 1)
      }
    }
    if (change) {
      this.applyCallback('updatePick', {
        action: 'delete',
        wfid: this.event.hoverWf!.opt.id,
        picks: this.event.selectedPicks
      })
      this.draw()
    }
  }

  setFocusWaveform (index: number) {
    this.event.hoverWf = this.waveforms[index]
  }

  selectPick (ev: MouseEvent) {
    console.log(`[${this.opt.mode}::selectPick]`)
    this.event.clickPos = this.getMouseX(ev)
    this.draw()
  }

  setPolarity (polarity: string | null) {
    if (this.event.selectedPicks.length === 0) {
      return
    }
    for (const p of this.event.selectedPicks) {
      p.polarity = polarity
    }
    this.draw()
    this.applyCallback('updatePick', {
      action: 'update',
      wfid: this.event.hoverWf!.opt.id,
      picks: this.event.selectedPicks
    })
  }

  setTimeUncertainty (lower: number | null, upper?: number | null) {
    if (upper == null) {
      upper = lower
    }
    if (this.event.selectedPicks.length === 0) {
      return
    }
    for (const p of this.event.selectedPicks) {
      p.lower_uncertainty = lower
      p.upper_uncertainty = upper
    }
    this.draw()
    this.applyCallback('updatePick', {
      action: 'update',
      wfid: this.event.hoverWf!.opt.id,
      picks: this.event.selectedPicks
    })
  }

  createPick () {
    if (this.event.phase != null && this.event.phase !== '') {
      const ref = this.waveforms[0].opt.ttt[this.view.refTime]
      const t = this.event.pickLineTime as number
      const newPick = {
        phase: this.event.phase,
        mode: 'manual',
        time: t,
        lower_uncertainty: null,
        upper_uncertainty: null,
        polarity: null,
        id: null,
        weight: 1,
        residual: (t - this.waveforms[0].opt.ttt[this.event.phase]) / 1000
      }
      // remove all picks of same phase as newPick in all waveforms (keep only one pick per phase)
      for (const wf of this.getDisplayedWaveforms()) {
        for (const p of wf.opt.picks.filter((x: WaveformPick) => x.phase === newPick.phase)) {
          this.applyCallback('updatePick', {
            action: 'delete', wfid: wf.opt.id, picks: [p]
          })
          wf.opt.picks.splice(wf.opt.picks.indexOf(p), 1)
        }
      }
      this.event.hoverWf!.opt.picks.push(newPick)
      // this.event.clickPos = null
      this.event.selectedPicks = []
      this.event.clickPos = this.time2pos(ref, t)
      // this.draw()
      this.clearCanvas(this.event.hoverWf!.ctx2!)
      this.drawPicks(this.event.hoverWf!)
      this.applyCallback('updatePick', {
        action: 'add', wfid: this.event.hoverWf!.opt.id, picks: [newPick]
      })
    }
  }

  movePickLine (direction: string, fast: boolean) {
    const sign = direction === 'right' ? 1 : -1
    const shift = fast ? this.view.duration * 0.05 : this.view.xRatio
    if (this.event.pickLineTime == null) {
      this.event.pickLineTime = this.waveforms[0].opt.ttt[this.view.refTime]
    }
    this.event.pickLineTime += sign * shift
    this.updatePickLine()
  }

  updatePickLine () {
    if (this.event.phase != null && this.event.phase !== '') {
      const ref = this.waveforms[0].opt.ttt[this.view.refTime]
      if (this.event.pickLineTime == null) {
        this.event.pickLineTime = ref
      }
      const pos = this.time2pos(ref, this.event.pickLineTime)
      for (const [i, wf] of this.getDisplayedWaveforms().entries()) {
        const ctx = wf.ctx2 as CanvasRenderingContext2D
        this.clearCanvas(ctx)
        this.drawPicks(wf)
        ctx.save()
        ctx.textBaseline = 'top'
        ctx.fillStyle = this.opt.color.lineBar
        ctx.fillRect(pos, 0, 1, this.opt.size.height)
        if (i === 0) {
          ctx.fillText(this.event.phase, pos + 4, 3)
        }
        ctx.restore()
      }
    } else {
      for (const wf of this.getDisplayedWaveforms()) {
        const ctx = wf.ctx2 as CanvasRenderingContext2D
        this.clearCanvas(ctx)
        this.drawPicks(wf)
      }
    }
  }

  drawPickInfo (pick: WaveformPick) {
    const ref = this.waveforms[0].opt.ttt[this.view.refTime]
    const pickPos = this.time2pos(ref, pick.time)
    const wf = this.event.hoverWf as WaveformItem
    const ctx = wf.ctx2 as CanvasRenderingContext2D
    const txt = [
      `creation time: ${pick.creation_info!._pretty_creation_time}`,
      `filter: ${pick.filter}`,
      `author: ${pick.creation_info!.author}`
    ]
    const maxWidth = Math.max.apply(null, txt.map(t => ctx.measureText(t).width))
    ctx.save()
    ctx.fillStyle = 'white'
    ctx.font = '10px, sans-serif'
    ctx.textBaseline = 'top'
    ctx.fillRect(pickPos + 6, 5, maxWidth + 10, 10 + txt.length * 10 + (txt.length - 1) * 3)
    ctx.fillStyle = 'black'
    let y = 10
    for (const t of txt) {
      ctx.fillText(t, pickPos + 11, y)
      y += 13
    }
    ctx.restore()
  }

  setPickerPhase (phase: string) {
    if (this.opt.mode !== 'picker') {
      return
    }
    this.event.phase = phase
  }

  sortWaveformsBy (keyAccesor: (wf: WaveformItemOptions) => any) {
    const traceContainer = this.mainElement!.children[0]
    this.waveforms.sort((a, b) => {
      const aa = keyAccesor(a.opt)
      const bb = keyAccesor(b.opt)
      return aa === bb ? 0 : aa < bb ? -1 : 1
    })
    for (const wf of this.getDisplayedWaveforms(true)) {
      traceContainer.appendChild(wf.el as HTMLElement)
      wf.el!.querySelector('.distance')!.innerHTML = `${wf.opt.distance.toFixed(2)}°`
    }
  }

  xZoomOut () {
    this.view.duration *= 1.2
    this.draw()
  }

  xZoomIn () {
    this.view.duration *= 0.8
    this.draw()
  }

  yZoomIn () {
    this.view.gain *= 1.2
    this.draw()
  }

  yZoomOut () {
    this.view.gain *= 0.8
    this.draw()
  }

  setSelectedWaveformWindow (view: {start: number, end: number}) {
    const wf = this.event.selectedWf as WaveformItem
    const p1 = this.time2pos(wf.opt.ttt[this.view.refTime], view.start)
    const p2 = this.time2pos(wf.opt.ttt[this.view.refTime], view.end)
    const ctx = wf.ctx3 as CanvasRenderingContext2D
    ctx.save()
    this.clearCanvas(ctx)
    ctx.fillStyle = this.opt.color.selectedWindow
    ctx.fillRect(p1, ctx.canvas.height / 2, p2 - p1, ctx.canvas.height / 2)
    ctx.restore()
    // this.drawPicks(wf)
  }

  selectWaveform (wf: WaveformItem) {
    if (this.opt.mode !== 'list') return
    if (this.event.selectedWf != null) {
      this.event.selectedWf.el!.classList.remove('selected')
      const ctx = this.event.selectedWf.ctx2 as CanvasRenderingContext2D
      this.clearCanvas(ctx)
      this.drawPicks(this.event.selectedWf)
    }
    this.event.selectedWf = wf
    this.event.selectedWf.el!.classList.add('selected')
    this.applyCallback('waveformClick', this.event.selectedWf.opt)
  }

  selectPrev () {
    const wfList = this.getDisplayedWaveforms()
    if (this.event.selectedWf == null) {
      this.selectWaveform(wfList[0])
    } else {
      const i = wfList.indexOf(this.event.selectedWf) - 1
      if (i < 0) {
        this.selectWaveform(wfList.slice(-1)[0])
      } else {
        this.selectWaveform(wfList[i])
      }
    }
    return this
  }

  selectNext () {
    const wfList = this.getDisplayedWaveforms()
    if (this.event.selectedWf == null) {
      this.selectWaveform(wfList[0])
    } else {
      const i = wfList.indexOf(this.event.selectedWf) + 1
      if (i >= wfList.length) {
        this.selectWaveform(wfList[0])
      } else {
        this.selectWaveform(wfList[i])
      }
    }
    return this
  }

  /**
   * DATA COMPUTATION FUNCTIONS
   */
  computeWaveformStatsAndGroupData (wf: WaveformItem) {
    const values = this.getValues(wf)
    let sppx = this.view.duration / (this.opt.size.width * wf.opt.step)
    let useGrouping = true
    let i = Math.max(0, this.time2index(wf, this.getStartTime(wf)))
    const iend = Math.min(values.length - 1, this.time2index(wf, this.getEndTime(wf)))
    wf.stats = { min: null, max: null, sum: 0.0, count: 0, avg: null, amp: null }
    wf.groupedValues = []
    // console.log(i, iend, sppx);
    if (sppx < 3) {
      sppx = (iend - i) + 1
      useGrouping = false
    }
    while (i <= iend) {
      const currentGroup = values.slice(i, i + sppx)
      const currStats: WaveformStats = { sum: 0.0, sqSum: 0.0, count: 0, min: null, max: null, avg: null, amp: null }
      for (let j = 0, l = currentGroup.length; j < l; j++) {
        const v = currentGroup[j]
        if (v == null) continue
        if (currStats.min == null || v < currStats.min) currStats.min = v
        if (currStats.max == null || v > currStats.max) currStats.max = v
        currStats.sum += v
        currStats.count++
      }
      if (currStats.min == null || currStats.max == null) {
        wf.groupedValues.push(null)
      } else {
        wf.groupedValues.push([currStats.min, currStats.max])
        if (wf.stats.min == null || currStats.min < wf.stats.min) wf.stats.min = currStats.min
        if (wf.stats.max == null || currStats.max > wf.stats.max) wf.stats.max = currStats.max
        wf.stats.sum += currStats.sum
        wf.stats.count += currStats.count
      }
      i += sppx
    }
    wf.stats.avg = wf.stats.count > 0 ? wf.stats.sum / wf.stats.count : null
    wf.stats.amp = wf.stats.max! - wf.stats.min!
    if (!useGrouping) {
      wf.groupedValues = null
    }
    return (wf.stats.max! - wf.stats.min!) / wf.opt.scale
  }

  getStatsAndGroupData () {
    for (const wf of this.getDisplayedWaveforms()) {
      const amp = this.computeWaveformStatsAndGroupData(wf)
      if (this.view.maxAmp == null || amp > this.view.maxAmp) {
        this.view.maxAmp = amp
      }
    }
    this.view.xRatio = this.view.duration / this.opt.size.width // s/px
  }

  computeWaveformDrawOption (wf: WaveformItem) {
    if (wf.stats == null) {
      return
    }
    const amp = (wf.stats.max! - wf.stats.min!) / wf.opt.scale
    wf.drawOpt = {
      scaleGain: this.opt.equalScale ? amp / this.view.maxAmp : 1,
      step: wf.opt.step / this.view.xRatio,
      x0: 0,
      yRatio: 1
    }
    if (this.getStartTime(wf) < wf.opt.start) {
      wf.drawOpt.x0 = this.time2pos(wf.opt.ttt[this.view.refTime], wf.opt.start)
    }
    if (wf.stats.count === 0) {
      return
    }
    let min = wf.stats.min as number
    let max = wf.stats.max as number
    let delta = max - min
    // if (delta < 1) delta = 1;
    min -= delta * 0.2
    max += delta * 0.2
    delta = max - min
    const amplitude = max === min ? 1 : max - min
    Object.assign(wf.drawOpt, {
      min: min,
      max: max,
      yRatio: this.opt.size.height / amplitude
    })
  }

  /**
   * DRAW FUNCTIONS
   */
  drawXGrid (wf: WaveformItem) {
    // console.log(`[${this.opt.mode}::drawXGrid] ${wf.opt.id}`)
    const tickStep = this.xGridScales[this.getXGridStepIndex()]
    const start = this.getStartTime(wf)
    let tick = start - (start % tickStep) + tickStep
    const ctx = wf.ctx as CanvasRenderingContext2D
    ctx.save()
    ctx.fillStyle = this.opt.color.grid
    while (tick - start < this.view.duration) {
      ctx.fillRect(this.time2pos(wf.opt.ttt[this.view.refTime], tick), 0, 1, this.opt.size.height)
      tick += tickStep
    }
    ctx.restore()
  }

  drawLine (wf: WaveformItem) {
    // console.log(`[${this.opt.mode}::drawLine] ${wf.opt.id}`)
    const ctx = wf.ctx as CanvasRenderingContext2D
    let x = wf.drawOpt!.x0
    ctx.save()
    ctx.strokeStyle = this.opt.color.line
    ctx.beginPath()
    const values = this.getValues(wf)
    if (wf.groupedValues == null) {
      const istart = Math.max(0, this.time2index(wf, this.getStartTime(wf)))
      const iend = Math.min(values.length - 1, this.time2index(wf, this.getEndTime(wf)))
      let i = istart
      for (; i < iend; i++) {
        const y = values[i]
        if (y != null) {
          const pos = this.value2pos(wf, y)
          if (i === istart || values[i - 1] == null) {
            ctx.moveTo(x, pos)
          } else {
            ctx.lineTo(x, pos)
          }
        }
        x += wf.drawOpt!.step
        if (x > this.opt.size.width) {
          break
        }
      }
    } else {
      for (let i = 0, l = wf.groupedValues.length; i < l; i++) {
        const y = wf.groupedValues[i]
        if (y != null) {
          if (i === 0 || wf.groupedValues[i - 1] == null) {
            ctx.moveTo(x, this.value2pos(wf, y[0]))
          } else {
            ctx.lineTo(x, this.value2pos(wf, y[0]))
          }
          ctx.lineTo(x, this.value2pos(wf, y[1]))
        }
        x++
        if (x > this.opt.size.width) {
          break
        }
      }
    }
    ctx.stroke()
    ctx.restore()
  }

  clearCanvas (ctx: CanvasRenderingContext2D) {
    // console.log(`[${this.opt.mode}::clearCanvas]`, ctx)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  }

  clearAll () {
    // console.log(`[${this.opt.mode}::clearAll]`)
    for (const wf of this.getDisplayedWaveforms()) {
      this.clearCanvas(wf.ctx!)
      this.clearCanvas(wf.ctx2!)
    }
  }

  drawXAxis () {
    // console.log(`[${this.opt.mode}::drawXAxis]`)
    const d = new Date()
    const ctx = this.xAxis as CanvasRenderingContext2D
    const tickStepIndex = this.getXGridStepIndex()
    const minorTick = this.xGridScales[tickStepIndex]
    let majorTick = this.xGridScales[Math.max(0, tickStepIndex - 1)]
    if (minorTick === majorTick) {
      majorTick = minorTick * 2
    }
    this.clearCanvas(ctx)
    ctx.save()
    ctx.fillStyle = this.opt.color.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillRect(0, 0, ctx.canvas.width, 1)
    let refTime = this.view.refTime === 'O' ? this.waveforms[0].opt.ttt.O : 0
    if (this.view.refTime !== 'O' && this.opt.mode === 'picker') {
      refTime = this.waveforms[0].opt.ttt[this.view.refTime]
    }
    const start = refTime + this.view.offset - this.view.duration / 2
    let tick = start - (start % minorTick) + minorTick
    while (tick - start < this.view.duration) {
      const pos = this.time2pos(refTime, tick)
      if (tick % majorTick === 0) {
        ctx.fillRect(pos, 0, 1, 8)
        d.setTime(tick)
        let t: string | number = tick / 1000
        if (this.view.refTime === 'O' || this.opt.mode === 'picker') {
          t = ((tick % 86400000) === 0
            ? `${d.getDate()}/${d.getMonth() + 1}`
            : (tick % 86400000) === 0
                ? `${d.getDate()}/${d.getMonth() + 1}`
                : (tick % 60000) === 0
                    ? d.toISOString().substr(11, 5)
                    : (tick % 1000) === 0
                        ? d.toISOString().substr(11, 8)
                        : (tick % 100) === 0
                            ? d.toISOString().substr(11, 10)
                            : (tick % 10) === 0 ? d.toISOString().substr(11, 11) : '')
        }
        ctx.fillText(t as string, pos, 10)
      } else {
        ctx.fillRect(pos, 0, 1, 5)
      }
      tick += minorTick
    }
    ctx.restore()
  }

  drawAVGLine (wf: WaveformItem) {
    // console.log(`[${this.opt.mode}::drawAVGLine] ${wf.opt.id}`);
    const ctx = wf.ctx as CanvasRenderingContext2D
    ctx.save()
    ctx.fillStyle = this.opt.color.avgLine
    ctx.fillRect(0, this.value2pos(wf, wf.stats!.avg!), this.opt.size.width, 1)
    ctx.restore()
  }

  drawTTT (wf: WaveformItem) {
    // console.log(`[${this.opt.mode}::drawTTT] ${wf.opt.id}`);
    const ctx = wf.ctx as CanvasRenderingContext2D
    if (wf.opt.ttt == null) {
      return
    }
    ctx.save()
    ctx.fillStyle = this.opt.color.theoretical
    for (const [p, t] of Object.entries(wf.opt.ttt)) {
      const pos = this.time2pos(wf.opt.ttt[this.view.refTime], t)
      if (p === 'O') {
        ctx.save()
        ctx.fillStyle = 'red'
        ctx.fillRect(pos, 0, 1, this.opt.size.height)
        ctx.restore()
      } else {
        ctx.fillRect(pos, 0, 1, this.opt.size.height)
        if ((this.opt.mode === 'picker' &&
             this.waveforms.indexOf(wf) === this.waveforms.length - 1) ||
            this.opt.mode === 'list') {
          ctx.fillText(p, pos + 3, this.opt.size.height - 3)
        }
      }
    }
    ctx.restore()
  }

  drawPicks (wf: WaveformItem) {
    if (wf.ctx2 == null) {
      return
    }
    const ctx = wf.ctx2
    this.clearCanvas(ctx)
    ctx.save()
    // this.event.selectedPicks = []
    ctx.textBaseline = 'top'
    ctx.setLineDash([4, 1])
    ctx.strokeStyle = 'gray'
    const ref = wf.opt.ttt[this.view.refTime]
    let pickList: WaveformPick[] = []
    if (this.opt.mode === 'list') {
      const key = wf.opt.id.slice(0, -1)
      for (const currWf of this.waveforms) {
        if (currWf.opt.id.indexOf(key) === 0) {
          pickList = pickList.concat(currWf.opt.picks)
        }
      }
    } else {
      pickList = pickList.concat(wf.opt.picks)
    }
    for (const p of pickList) {
      const pos = this.time2pos(ref, p.time)
      if (this.event.clickPos != null &&
          wf === this.event.hoverWf &&
          Math.abs(this.event.clickPos - pos) < 5) {
        this.event.selectedPicks.push(p)
        ctx.beginPath()
        ctx.moveTo(pos - 4.5, 0)
        ctx.lineTo(pos - 4.5, this.opt.size.height)
        ctx.moveTo(pos + 4.5, 0)
        ctx.lineTo(pos + 4.5, this.opt.size.height)
        ctx.stroke()
      }
      ctx.fillStyle = this.opt.color.uncertainty
      if (p.lower_uncertainty != null) {
        const minPos = this.time2pos(ref, p.time - p.lower_uncertainty * 1e3)
        ctx.fillRect(minPos, 0, pos - minPos, this.opt.size.height)
      }
      if (p.upper_uncertainty != null) {
        const maxPos = this.time2pos(ref, p.time + p.upper_uncertainty * 1e3)
        ctx.fillRect(pos, 0, maxPos - pos, this.opt.size.height)
      }
      ctx.fillStyle = this.opt.color[p.mode]
      ctx.fillRect(pos - 0.5, 0, 1, this.opt.size.height)
      if (p.polarity != null) {
        ctx.beginPath()
        if (p.polarity === 'positive') {
          ctx.moveTo(pos - 4.5, 10)
          ctx.lineTo(pos + 4.5, 10)
          ctx.lineTo(pos, 0)
          ctx.closePath()
        } else if (p.polarity === 'negative') {
          const h = this.opt.size.height
          ctx.moveTo(pos - 4.5, h - 10)
          ctx.lineTo(pos + 4.5, h - 10)
          ctx.lineTo(pos, h)
          ctx.closePath()
        }
        ctx.fill()
      }
      ctx.fillText(p.phase, pos + 6, 3)
    }
    ctx.restore()
  }

  drawAmplitudeValue (wf: WaveformItem) {
    const ctx = wf.ctx as CanvasRenderingContext2D
    ctx.save()
    ctx.fillStyle = this.opt.color.amplitudeValue
    ctx.fillText(wf.stats!.amp!.toFixed(0), 103, this.opt.size.height - 3)
    ctx.restore()
  }

  getDisplayedWaveforms (refresh = false) {
    if (!refresh) {
      return this.displayedWaveforms
    }
    const order = ['N', 'H']
    if (this.opt.mode === 'list') {
      const netstaWf: {[index: string]: WaveformItem[]} = {}
      for (const wf of this.waveforms) {
        const netsta = wf.opt.id.split('.').slice(0, 2).join('.')
        if (netstaWf[netsta] == null) {
          netstaWf[netsta] = []
        }
        netstaWf[netsta].push(wf)
      }
      const wfList = []
      for (const [netsta, netstaList] of Object.entries(netstaWf)) {
        const zChannel = netstaList.filter(wf => wf.opt.id.slice(-1) === 'Z')
        if (zChannel.length === 0) {
          console.log(`No vertical component found for ${netsta}, use the first channel found to display in list (${netstaList[0].opt.id})`)
          zChannel.push(netstaList[0])
        }
        zChannel.sort((a, b) => {
          const aa = order.indexOf(a.opt.id.slice(-2)[0])
          const bb = order.indexOf(b.opt.id.slice(-2)[0])
          return aa < bb ? 1 : aa > bb ? -1 : 0
        })
        wfList.push(zChannel.slice(-1)[0])
      }
      this.displayedWaveforms = wfList
      return wfList
    }
    this.displayedWaveforms = this.waveforms
    return this.displayedWaveforms
  }

  plotWaveform (wf: WaveformItem) {
    // console.log(`[${this.opt.mode}::plotWaveform] ${wf.opt.id}`)
    this.computeWaveformDrawOption(wf)
    this.drawXGrid(wf)
    this.drawTTT(wf)
    if (wf.stats!.count > 1) {
      this.drawAVGLine(wf)
      this.drawLine(wf)
    }
    this.drawPicks(wf)
    this.drawAmplitudeValue(wf)
  }

  draw () {
    // console.log(`[${this.opt.mode}::draw]`)
    this.clearAll()
    this.getStatsAndGroupData()
    this.event.selectedPicks = []
    for (const wf of this.getDisplayedWaveforms()) {
      this.plotWaveform(wf)
    }
    this.drawXAxis()
    if (this.opt.mode === 'picker') {
      const wf = this.waveforms[0]
      this.applyCallback('draw', {
        start: this.getStartTime(wf), end: this.getEndTime(wf)
      })
    }
  }
}
