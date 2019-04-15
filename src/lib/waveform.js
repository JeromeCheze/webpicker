export default class Waveform {

  constructor (opt) {
    this.xGridScales = [
      31536000000, 15768000000,                       // >/= 6 months
      4838400000, 2419200000, 604800000,              // >/= 7days
      172800000, 86400000,                            // >/= 1 day
      43200000, 21600000, 14400000, 7200000, 3600000, // >/= 1 hour
      1800000, 600000, 300000, 120000, 60000,         // >/= 1 minute
      30000, 10000, 5000, 2000, 1000,                 // >/= 1 seconde
      500, 200, 100,                                  // < 1 seconde
      50, 20, 10                                      // < 100 ms
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
      selectedWindow: [],
      selectedPicks: [],
      hoverWf: null,
      phase: null,
      x: null
    }
    this.loadOptions(opt)
    this.initStructure()
    this.bindEventHandlers()
    this.draw()
  }

  loadOptions (opt) {
    // default options
    this.opt = {
      /* required */
      container: null,
      mode: 'list',// 'list' or 'picker'
      waveforms : [],/*[
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
      ]*/
      /* optional */
      // -- style --
      size: {
        height: 50,// the height of a single waveform
        wrapperMaxHeight: 400,// trace container max height
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
        selectedWindow: 'rgba(0, 0, 0, 0.1)',
        border: 'black',
        text: 'black',
        // label
        labelBackground: 'rgba(75, 75, 75, 0.8)',
        labelText: 'white',
        // line
        line: '#9cb9c9',
        avgLine: 'rgba(180,180,180,.3)',//'#a6dfea',
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
    if (typeof this.opt.container == 'string') {
      this.opt.container = document.querySelector(this.opt.container)
    }
    // get the width of the container if not given in option
    if (this.opt.size.width === null) {
      let pad = window.getComputedStyle(this.opt.container).padding
      this.opt.size.width = this.opt.container.clientWidth - 2 * parseInt(pad == '' ? 0 : pad)
    }
    this.event.xOffset = this.opt.container.getBoundingClientRect().x
    let start, end;
    for (let wf of this.opt.waveforms) {
      let currStart = Math.min(wf.start, wf.ttt.O),
          currEnd = Math.max(wf.start+wf.values.length*wf.step, wf.ttt.O)
      if (start == null || currStart < start) start = currStart
      if (end == null || currEnd > end) end = currEnd
      if (wf.picks == null) {
        wf.picks = []
      }
      wf.scale = wf.scale == null ? 1. : wf.scale * 1.
      this.waveforms.push({ opt: wf })
    }
    this.view = Object.assign({}, this.opt.view)
    if (this.view.duration == null) {
      this.view.duration = end - start
    }
    if (this.view.offset == null) {
      this.view.offset = this.view.duration / 2
    }
  }

  initStyle () {
    let styleId = 'waveform-style';
    let styleEl = document.getElementById(styleId)
    if (styleEl != null) {
      styleEl.parentNode.removeChild(styleEl)
    }
    let s = document.createElement('style');
    s.id = styleId;
    s.innerHTML = `
    .trace-container {
      overflow-x: hidden;
      overflow-y: auto;
      border-top: 1px solid ${this.opt.color.border};
    }
    .wf-container {position: relative; background: ${this.opt.color.background};}
    .wf-list .wf-container:nth-child(even) {background: ${this.opt.color.backgroundEven};}
    .wf-list .wf-container.selected {background: ${this.opt.color.selected};}
    .wf-canvas, .user-canvas {position: absolute; top: 0; left: 0; z-index: 0;}
    .user-canvas {z-index: 10;}
    .wf-label-container {position: absolute; top: 0; left: 0; background: ${this.opt.color.labelBackground}; z-index: 10; width: 100px;}
    .wf-label {font-family: sans-serif; color: ${this.opt.color.labelText}; font-size: 10px; margin: 5px;}
    .wf-label .distance {font-size: .9em; margin: 10px;}`;
    document.head.appendChild(s);
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
    this.initStyle();
    let mainElement = document.createElement('div'),
        traceContainer = document.createElement('div'),
        xAxis = document.createElement('canvas')
    xAxis.width = this.opt.size.width
    xAxis.height = 40
    mainElement.appendChild(traceContainer)
    mainElement.appendChild(xAxis)
    traceContainer.classList.add('trace-container')
    traceContainer.style.maxHeight = `${this.opt.size.wrapperMaxHeight}px`
    traceContainer.classList.add(this.opt.mode == 'picker' ? 'wf-picker' : 'wf-list')
    //Object.assign(traceContainer.style, {overflowX: 'hidden', overflowY: 'auto', maxHeight: '400px'});
    for (let wf of this.waveforms) {
      let wfContainer = document.createElement('div'),
          wfCanvas = document.createElement('canvas'),
          userCanvas = document.createElement('canvas'),
          wfLabelContainer = document.createElement('div'),
          wfLabel = document.createElement('div')
      traceContainer.appendChild(wfContainer)
      wfContainer.appendChild(wfCanvas)
      wfContainer.appendChild(userCanvas)
      wfContainer.appendChild(wfLabelContainer)
      wfLabelContainer.appendChild(wfLabel)
      wfContainer.className = 'wf-container'
      wfContainer.style.height = `${this.opt.size.height}px`
      wfLabelContainer.style.height = `${this.opt.size.height}px`
      wfLabel.className = 'wf-label'
      wfCanvas.className = 'wf-canvas'
      userCanvas.className = 'user-canvas'
      wfLabelContainer.className = 'wf-label-container'
      wfLabel.innerHTML = `<strong>${wf.opt.id}</strong>`
      if (wf.opt.distance != null) {
        wfLabel.innerHTML += `<br><span class="distance">${wf.opt.distance.toFixed(2)}°</span>`
      }
      wfCanvas.width = this.opt.size.width
      wfCanvas.height = this.opt.size.height
      userCanvas.width = this.opt.size.width
      userCanvas.height = this.opt.size.height
      wf.ctx = wfCanvas.getContext('2d')
      wf.ctx2 = userCanvas.getContext('2d')
      wf.el = wfContainer
      this.event.handlers.push(
        {type: 'mouseenter', el: wf.el, callback: ev => this.handleWaveformMouseenter(ev)}
      )
      if (this.opt.mode == 'picker') {
        this.event.handlers = this.event.handlers.concat([
          {type: 'mousemove', el: userCanvas, callback: ev => this.handleMouseMove(ev)},
          {type: 'dblclick', el: userCanvas, callback: ev => this.handleDblClick(ev)},
          {type: 'click', el: userCanvas, callback: ev => this.selectPick(ev)}
        ])
      }
    }
    this.mainElement = mainElement
    this.xAxis = xAxis.getContext('2d')
    this.opt.container.appendChild(mainElement)
    this.event.handlers = this.event.handlers.concat([
      {type: 'wheel', el: mainElement, callback: ev => this.wheelHandler(ev)},
      {type: 'mousedown', el: mainElement, callback: ev => this.mouseDownHandler(ev)},
      {type: 'mousemove', el: mainElement, callback: ev => this.mouseMoveHandler(ev)},
      {type: 'mouseup', el: mainElement, callback: ev => this.mouseUpHandler(ev)}
    ])
    // this.event.handlers.push(
    //   {type: 'keydown', el: document.body, callback: ev => this.handleKeyDown(ev)}
    // )
  }

  /**
   * UTILITIES
   */
  recursiveCopy (obj1, obj2) {
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

  setTimeAlignment (ref) {
    this.view.refTime = ref
    this.view.offset = ref == 'O' ? this.view.duration/2 : 0
  }

  getMouseX (ev) {
    return ev.clientX - this.event.xOffset
  }

  time2index (wf, t) {
    return Math.floor((t - wf.opt.start) / wf.opt.step)
  }

  time2pos (ref, t) {
    return Math.floor(this.opt.size.width/2 + (t-ref-this.view.offset)/this.view.xRatio)
  }

  pos2time (ref, p) {
    return this.view.xRatio * (p - this.opt.size.width/2) + ref + this.view.offset
  }

  value2pos (wf, v) {
    return Math.floor(this.opt.size.height / 2
                      - (v - wf.stats.avg)
                        * wf.drawOpt.yRatio
                        * this.view.gain
                        * wf.drawOpt.scaleGain)
  }

  getXGridStepIndex () {
    let i, tickInterval = this.view.duration / (this.opt.size.width / 40); // each ticks must be separated by 40px minimum
    for (i=0; tickInterval < this.xGridScales[i]; i++);
    return i-1;
  }

  getValues (wf) {
    return (
      this.event.useFiltered == false ?
      wf.opt.values :
      wf.opt.filtered != null ? wf.opt.filtered : []
    )
  }

  /**
   * EVENT HANDLERS
   */
  bindEventHandlers () {
    for (let e of this.event.handlers) {
      e.el.addEventListener(e.type, e.callback)
    }
  }

  wheelHandler (ev) {
    if (ev.shiftKey) {
      ev.preventDefault()
      let delta = (
        Math.abs(ev.deltaY) > 1 ? ev.deltaY :
        Math.abs(ev.deltaX) > 1 ? ev.deltaX :
        0
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
      if (ev.ctrlKey || ev.metaKey ) {
        Math.sign(delta) > 0 ? this.yZoomOut() : this.yZoomIn()
      } else {
        Math.sign(delta) > 0 ? this.xZoomOut() : this.xZoomIn()
      }
    }
  }

  mouseDownHandler (ev) {
    ev.preventDefault()
    this.event.x = this.getMouseX(ev)
    this.event.moved = false
  }

  mouseMoveHandler (ev) {
    let pos = this.getMouseX(ev)
    if (this.event.x != null) {
      let delta = this.event.x - pos
      if (Math.abs(delta) > 5) {
        this.event.moved = true
        this.event.x = pos
        let sign = Math.sign(delta),
            deltaT = Math.abs(delta) * this.view.xRatio
        this.view.offset += deltaT*sign
        this.draw()
      }
    }
  }

  mouseUpHandler (ev) {
    if (!this.event.moved) {
      if (this.event.hoverWf != null) {
        this.selectWaveform(this.event.hoverWf)
      }
    }
    if (this.event.x != null) {
      delete this.event.x
    }
    this.event.moved = false
  }

  handleWaveformMouseenter (ev) {
    let wf = this.waveforms.find(x => x.el == ev.target)
    this.event.hoverWf = wf
    this.applyCallback('waveformFocus', this.waveforms.indexOf(wf))
  }

  handleDblClick (ev) {
    let ref = this.waveforms[0].opt.ttt[this.view.refTime]
    this.event.pickLineTime = this.pos2time(ref, this.getMouseX(ev))
    this.createPick()
  }

  handleMouseMove (ev) {
    let ref = this.waveforms[0].opt.ttt[this.view.refTime]
    this.event.pickLineTime = this.pos2time(ref, this.getMouseX(ev))
    this.updatePickLine()
  }

  applyCallback (callbackName, arg) {
    if (this.opt.callback[callbackName] != null) {
      this.opt.callback[callbackName].call(null, arg)
    }
  }

  /**
   * ACTIONS
   */
  destroy () {
    for (let e of this.event.handlers) {
      e.el.removeEventListener(e.type, e.callback)
    }
    this.mainElement.parentNode.removeChild(this.mainElement)
  }

  getStartTime (wf) {
    return wf.opt.ttt[this.view.refTime] + this.view.offset - this.view.duration/2
  }

  getEndTime (wf) {
    return wf.opt.ttt[this.view.refTime] + this.view.offset + this.view.duration/2
  }

  setFilterState (state) {
    this.event.useFiltered = state
    this.draw()
  }

  deleteSelectedPicks () {
    let change = false
    for (let p of this.event.selectedPicks) {
      let i = this.event.hoverWf.opt.picks.indexOf(p)
      if (i >= 0) {
        change = true
        this.event.hoverWf.opt.picks.splice(i, 1)
      }
    }
    if (change) {
      this.applyCallback('updatePick', {
        action: 'delete',
        wfid: this.event.hoverWf.opt.id,
        picks: this.event.selectedPicks
      })
      this.draw()
    }
  }

  setFocusWaveform (index) {
    this.event.hoverWf = this.waveforms[index]
  }

  selectPick (ev) {
    this.event.clickPos = this.getMouseX(ev)
    this.draw()
  }

  setPolarity (polarity) {
    if (this.event.selectedPicks.length == 0) {
      return
    }
    for (let p of this.event.selectedPicks) {
      p.polarity = polarity
    }
    this.draw()
    this.applyCallback('updatePick', {
      action: 'update',
      wfid: this.event.hoverWf.opt.id,
      picks: this.event.selectedPicks
    })
  }

  setTimeUncertainty (lower, upper) {
    if (upper == null) {
      upper = lower
    }
    if (this.event.selectedPicks.length == 0) {
      return
    }
    for (let p of this.event.selectedPicks) {
      p.lower_uncertainty = lower
      p.upper_uncertainty = upper
    }
    this.draw()
    this.applyCallback('updatePick', {
      action: 'update',
      wfid: this.event.hoverWf.opt.id,
      picks: this.event.selectedPicks
    })
  }

  createPick () {
    if (this.event.phase != null && this.event.phase != '') {
      let ref = this.waveforms[0].opt.ttt[this.view.refTime]
      let t = this.event.pickLineTime
      let newPick = {
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
      for (let wf of this.waveforms) {
        for (let p of wf.opt.picks.filter(x => x.phase == newPick.phase)) {
          this.applyCallback('updatePick', {
            action: 'delete', wfid: wf.opt.id, picks: [p]
          })
          wf.opt.picks.splice(wf.opt.picks.indexOf(p), 1)
        }
      }
      this.event.hoverWf.opt.picks.push(newPick)
      // this.event.clickPos = null
      this.event.clickPos = this.time2pos(ref, t)
      this.draw()
      this.applyCallback('updatePick', {
        action: 'add', wfid: this.event.hoverWf.opt.id, picks: [newPick]
      })
    }
  }

  movePickLine ({ direction, fast }) {
    let sign = direction == 'right' ? 1 : -1
    let shift = fast ? this.view.duration * 0.05 : this.view.xRatio
    if (this.event.pickLineTime == null) {
      this.event.pickLineTime = this.waveforms[0].opt.ttt[this.view.refTime]
    }
    this.event.pickLineTime += sign * shift
    this.updatePickLine()
  }

  updatePickLine () {
    if (this.event.phase != null && this.event.phase != '') {
      let ref = this.waveforms[0].opt.ttt[this.view.refTime]
      if (this.event.pickLineTime == null) {
        this.event.pickLineTime = ref
      }
      let pos = this.time2pos(ref, this.event.pickLineTime)
      for (let [i, wf] of this.waveforms.entries()) {
        let ctx = wf.ctx2
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        ctx.save()
        ctx.textBaseline = 'top'
        ctx.fillStyle = this.opt.color.lineBar
        ctx.fillRect(pos, 0, 1, this.opt.size.height)
        if (i == 0) {
          ctx.fillText(this.event.phase, pos+4, 3)
        }
        ctx.restore()
      }
    } else {
      for (let wf of this.waveforms) {
        let ctx = wf.ctx2
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      }
    }
  }

  setPickerPhase (phase) {
    if (this.opt.mode != 'picker') return
    this.event.phase = phase
  }

  sortWaveformsBy (keyAccesor) {
    let traceContainer = this.mainElement.children[0];
    this.waveforms.sort((a, b) => {
      a = keyAccesor(a.opt);
      b = keyAccesor(b.opt);
      return a == b ? 0 : a < b ? -1 : 1
    });
    for (let wf of this.waveforms) {
      traceContainer.appendChild(wf.el)
    }
  }

  xZoomOut () {
    this.view.duration *= 1.2
    this.draw()
  }

  xZoomIn () {
    this.view.duration *= .8
    this.draw()
  }

  yZoomIn () {
    this.view.gain *= 1.2
    this.draw()
  }

  yZoomOut () {
    this.view.gain *= .8
    this.draw()
  }

  setSelectedWaveformWindow (view) {
    let wf = this.event.selectedWf
    let p1 = this.time2pos(wf.opt.ttt[this.view.refTime], view.start)
    let p2 = this.time2pos(wf.opt.ttt[this.view.refTime], view.end)
    let ctx = wf.ctx2
    ctx.save()
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.fillStyle = this.opt.color.selectedWindow
    ctx.fillRect(p1, ctx.canvas.height/2, p2-p1, ctx.canvas.height/2)
    ctx.restore()
  }

  selectWaveform (wf) {
    if (this.opt.mode != 'list') return
    if (this.event.selectedWf != null) {
      this.event.selectedWf.el.classList.remove('selected')
      let ctx = this.event.selectedWf.ctx2
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas. height)
    }
    this.event.selectedWf = wf
    this.event.selectedWf.el.classList.add('selected')
    this.applyCallback('waveformClick', this.event.selectedWf.opt)
  }

  selectPrev () {
    if (this.event.selectedWf == null) {
      this.selectWaveform(this.waveforms[0])
    } else {
      let i = this.waveforms.indexOf(this.event.selectedWf) - 1
      if (i < 0) {
        i = this.waveforms.length - 1
      }
      this.selectWaveform(this.waveforms[i])
    }
    return this
  }

  selectNext () {
    if (this.event.selectedWf == null) {
      this.selectWaveform(this.waveforms[0])
    } else {
      let i = this.waveforms.indexOf(this.event.selectedWf) + 1
      if (i >= this.waveforms.length) {
        i = 0
      }
      this.selectWaveform(this.waveforms[i])
    }
  }

  /**
   * DATA COMPUTATION FUNCTIONS
   */
  getStatsAndGroupData () {
    let maxAmp
    for (let wf of this.waveforms) {
      let values = this.getValues(wf)
      let sppx = this.view.duration / (this.opt.size.width * wf.opt.step),
          useGrouping = true,
          i = Math.max(0, this.time2index(wf, this.getStartTime(wf))),
          iend = Math.min(values.length-1, this.time2index(wf, this.getEndTime(wf)))
      wf.stats = { min: null, max: null, sum: 0., count: 0, avg: null }
      wf.groupedValues = []
      //console.log(i, iend, sppx);
      if (sppx < 3) {
        sppx = (iend - i) + 1
        useGrouping = false
      }
      while (i <= iend) {
        let currentGroup = values.slice(i, i+sppx),
            currStats = { sum: 0., sq_sum: 0., count: 0 }
        for (let j=0, l=currentGroup.length; j<l; j++) {
          let v = currentGroup[j]
          if (v == null) continue
          if (currStats.min == null || v < currStats.min) currStats.min = v
          if (currStats.max == null || v > currStats.max) currStats.max = v
          currStats.sum += v; currStats.count++
        }
        if (currStats.min == null) wf.groupedValues.push(null)
        else {
          wf.groupedValues.push([currStats.min, currStats.max])
          if (wf.stats.min == null || currStats.min < wf.stats.min) wf.stats.min = currStats.min
          if (wf.stats.max == null || currStats.max > wf.stats.max) wf.stats.max = currStats.max
          wf.stats.sum += currStats.sum; wf.stats.count += currStats.count
        }
        i += sppx
      }
      wf.stats.avg = wf.stats.count > 0 ? wf.stats.sum / wf.stats.count : null
      wf.stats.amp = wf.stats.max - wf.stats.min
      if (!useGrouping) wf.groupedValues = null
      // MARKER
      let amp = (wf.stats.max - wf.stats.min) / wf.opt.scale
      if (maxAmp == null || amp > maxAmp) {
        maxAmp = amp
      }
      this.view.maxAmp = maxAmp
    }
  }

  computeDrawOption () {
    this.view.xRatio = this.view.duration / this.opt.size.width; // s/px
    for (let wf of this.waveforms) {
      let amp = (wf.stats.max - wf.stats.min) / wf.opt.scale
      wf.drawOpt = {
        scaleGain: this.opt.equalScale ? amp / this.view.maxAmp : 1,
        step: wf.opt.step / this.view.xRatio,
        x0: 0
      };
      if (this.getStartTime(wf) < wf.opt.start) {
        wf.drawOpt.x0 = this.time2pos(wf.opt.ttt[this.view.refTime], wf.opt.start);
      }
      if (wf.stats.count == 0) continue;
      let min = wf.stats.min,
          max = wf.stats.max;
      let delta = max - min;
      //if (delta < 1) delta = 1;
      min -= delta * .2;
      max += delta * .2;
      delta = max - min;
      let amplitude = max == min ? 1 : max - min
      Object.assign(wf.drawOpt, {
        min: min, max : max,
        yRatio: this.opt.size.height / amplitude
      });
    }
  }

  /**
   * DRAW FUNCTIONS
   */
  drawXGrid (wf) {
    let tickStep = this.xGridScales[this.getXGridStepIndex()];
    let start = this.getStartTime(wf);
    let tick = start - (start % tickStep) + tickStep,
        ctx  = wf.ctx;
    ctx.save();
    ctx.fillStyle = this.opt.color.grid;
    while (tick-start < this.view.duration) {
      ctx.fillRect(this.time2pos(wf.opt.ttt[this.view.refTime], tick), 0, 1, this.opt.size.height);
      tick += tickStep
    }
    ctx.restore();
  }

  drawLine (wf) {
    let ctx = wf.ctx,
        x = wf.drawOpt.x0;
    ctx.save();
    ctx.strokeStyle = this.opt.color.line;
    ctx.beginPath();
    let values = this.getValues(wf)
    if (wf.groupedValues == null) {
      let istart = Math.max(0, this.time2index(wf, this.getStartTime(wf))),
          iend = Math.min(values.length-1, this.time2index(wf, this.getEndTime(wf)));
      //console.log(iend);
      let i = istart;
      for (; i<iend; i++) {
        let y = values[i];
        if (y != null) {
          let pos = this.value2pos(wf, y);
          if (i == istart || values[i-1] == null) {
            ctx.moveTo(x, pos)
          } else {
            ctx.lineTo(x, pos)
          }
        }
        x += wf.drawOpt.step;
        if (x > this.opt.size.width) break;
      }
    } else {
      for (let i=0, l=wf.groupedValues.length; i<l; i++) {
        let y = wf.groupedValues[i];
        if (y != null) {
          if (i == 0 || wf.groupedValues[i-1] == null) {
            ctx.moveTo(x, this.value2pos(wf, y[0]));
          } else {
            ctx.lineTo(x, this.value2pos(wf, y[0]));
          }
          ctx.lineTo(x, this.value2pos(wf, y[1]));
        }
        x++;
        if (x > this.opt.size.width) break;
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  clearAll () {
    for (let wf of this.waveforms) {
      wf.ctx.clearRect(0, 0, wf.ctx.canvas.width, wf.ctx.canvas.height)
    }
  }

  drawXAxis () {
    let d = new Date(),
        ctx = this.xAxis,
        tickStepIndex = this.getXGridStepIndex();
    let minorTick = this.xGridScales[tickStepIndex],
        majorTick = this.xGridScales[Math.max(0, tickStepIndex-1)];
    if (minorTick == majorTick) {majorTick = minorTick * 2}
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    ctx.fillStyle = this.opt.color.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillRect(0, 0, ctx.canvas.width, 1);
    let refTime = this.view.refTime == 'O' ? this.waveforms[0].opt.ttt.O : 0;
    if (this.view.refTime != 'O' && this.opt.mode == 'picker') {
      refTime = this.waveforms[0].opt.ttt[this.view.refTime]
    }
    let start = refTime + this.view.offset - this.view.duration/2;
    let tick = start - (start % minorTick) + minorTick;
    while (tick-start < this.view.duration) {
      let pos = this.time2pos(refTime, tick);
      if (tick % majorTick == 0) {
        ctx.fillRect(pos, 0, 1, 8);
        d.setTime(tick);
        let t = tick/1000;
        if (this.view.refTime == 'O' || this.opt.mode == 'picker') {
          t = ((tick % 86400000) == 0 ? `${d.getDate()}/${d.getMonth()+1}` :
               (tick % 86400000) == 0 ? `${d.getDate()}/${d.getMonth()+1}` :
               (tick % 60000) == 0 ? d.toISOString().substr(11, 5) :
               (tick % 1000) == 0 ? d.toISOString().substr(11, 8) :
               (tick % 100) == 0 ? d.toISOString().substr(11, 10) :
               (tick % 10) == 0 ? d.toISOString().substr(11, 11) : '');
        }
        ctx.fillText(t, pos, 10);
      } else {
        ctx.fillRect(pos, 0, 1, 5);
      }
      tick += minorTick;
    }
    ctx.restore();
  }

  drawAVGLine (wf) {
    let ctx = wf.ctx;
    ctx.save();
    ctx.fillStyle = this.opt.color.avgLine;
    ctx.fillRect(0, this.value2pos(wf, wf.stats.avg), this.opt.size.width, 1);
    ctx.restore();
  }

  drawTTT (wf) {
    let ctx = wf.ctx
    if (wf.opt.ttt == null) return;
    ctx.save()
    ctx.fillStyle = this.opt.color.theoretical
    for (let [p, t] of Object.entries(wf.opt.ttt)) {
      let pos = this.time2pos(wf.opt.ttt[this.view.refTime], t)
      if (p == 'O') {
        ctx.save()
        ctx.fillStyle = 'red'
        ctx.fillRect(pos, 0, 1, this.opt.size.height)
        ctx.restore()
      } else {
        ctx.fillRect(pos, 0, 1, this.opt.size.height)
        if (this.opt.mode == 'picker' &&
            this.waveforms.indexOf(wf) == this.waveforms.length-1 ||
            this.opt.mode == 'list') {
          ctx.fillText(p, pos+3, this.opt.size.height-3)
        }
      }
    }
    ctx.restore()
  }

  drawPicks (wf) {
    let ctx = wf.ctx
    ctx.save()
    // this.event.selectedPicks = []
    ctx.textBaseline = 'top'
    ctx.setLineDash([4, 1])
    ctx.strokeStyle = 'gray'
    let ref = wf.opt.ttt[this.view.refTime]
    for (let p of wf.opt.picks) {
      let pos = this.time2pos(ref, p.time)
      if (this.event.clickPos != null &&
          wf == this.event.hoverWf &&
          Math.abs(this.event.clickPos - pos) < 5) {
        this.event.selectedPicks.push(p)
        ctx.beginPath()
        ctx.moveTo(pos-4.5, 0)
        ctx.lineTo(pos-4.5, this.opt.size.height)
        ctx.moveTo(pos+4.5, 0)
        ctx.lineTo(pos+4.5, this.opt.size.height)
        ctx.stroke()
      }
      ctx.fillStyle = this.opt.color.uncertainty
      if (p.lower_uncertainty != null) {
        let minPos = this.time2pos(ref, p.time - p.lower_uncertainty * 1e3)
        ctx.fillRect(minPos, 0, pos - minPos, this.opt.size.height)
      }
      if (p.upper_uncertainty != null) {
        let maxPos = this.time2pos(ref, p.time + p.upper_uncertainty * 1e3)
        ctx.fillRect(pos, 0, maxPos - pos, this.opt.size.height)
      }
      ctx.fillStyle = this.opt.color[p.mode]
      ctx.fillRect(pos-.5, 0, 1, this.opt.size.height)
      if (p.polarity != null) {
        ctx.beginPath()
        if (p.polarity == 'positive') {
          ctx.moveTo(pos-4.5, 10)
          ctx.lineTo(pos+4.5, 10)
          ctx.lineTo(pos, 0)
          ctx.closePath()
        } else if (p.polarity == 'negative') {
          let h = this.opt.size.height
          ctx.moveTo(pos-4.5, h-10)
          ctx.lineTo(pos+4.5, h-10)
          ctx.lineTo(pos, h)
          ctx.closePath()
        }
        ctx.fill()
      }
      ctx.fillText(p.phase, pos+6, 3)
    }
    ctx.restore()
  }

  drawAmplitudeValue (wf) {
    let ctx = wf.ctx
    ctx.save()
    ctx.fillStyle = this.opt.color.amplitudeValue
    ctx.fillText(wf.stats.amp.toFixed(0), 103, this.opt.size.height - 3)
    ctx.restore()
  }

  draw () {
    this.clearAll()
    this.getStatsAndGroupData()
    this.computeDrawOption()
    this.event.selectedPicks = []
    for (let wf of this.waveforms) {
      this.drawXGrid(wf)
      this.drawTTT(wf)
      if (wf.stats.count > 1) {
        this.drawAVGLine(wf)
        this.drawLine(wf)
      }
      this.drawPicks(wf)
      this.drawAmplitudeValue(wf)
    }
    this.drawXAxis()
    if (this.opt.mode == 'picker') {
      let wf = this.waveforms[0]
      this.applyCallback('draw', {
        start: this.getStartTime(wf), end: this.getEndTime(wf)
      })
    }
  }

}
