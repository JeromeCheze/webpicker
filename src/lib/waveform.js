export default class Waveform {

  constructor (opt) {
    this.xGridScales = [
      31536000000, 15768000000,                       // >/= 6 months
      4838400000, 2419200000, 604800000,              // >/= 7days
      172800000, 86400000,                            // >/= 1 day
      43200000, 21600000, 14400000, 7200000, 3600000, // >/= 1 hour
      1800000, 600000, 300000, 120000, 60000,         // >/= 1 minute
      30000, 10000, 5000, 2000, 1000,                 // >/= 1 seconde
      500, 200, 100                                   // < 1 seconde
    ]
    this.waveforms = []
    this.event = { handlers: [], xOffset: 0 }
    this.loadOptions(opt)
    this.initStructure()
    this.bindEventHandlers()
    this.draw()
  }

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
          id: 'XX.NOISE.00.HHZ',
          distance: <number>,
          ttt: {P: <js_timestamp>}, // ttt = "theoretical travel time"
          picks: [{phase: 'P', mode: 'manual', time: <js_timestamp>}]
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
        background: 'white',
        backgroundEven: '#e5eef1',
        grid: 'rgba(180,180,180,.3)',
        selected: '#c9e8f9',
        border: 'black',
        text: 'black',
        // label
        labelBackground: 'rgba(75, 75, 75, 0.8)',
        labelText: 'white',
        // line
        line: '#9cb9c9',
        // phases
        theoretical: 'blue',
        automatic: 'red',
        manual: '#1ab11b'
      },
      callback: {
        waveformClick: null
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
      this.waveforms.push({ opt: wf })
    }
    this.view = {
      refTime: 'O',
      duration: end-start,
      gain: 1
    }
    this.view.offset = this.view.duration/2
  }

  initStyle () {
    let styleId = 'waveform-style';
    if (document.getElementById(styleId) == null) {
      let s = document.createElement('style');
      s.id = styleId;
      s.innerHTML = `
        .trace-container {
          overflow-x: hidden;
          overflow-y: auto;
          max-height: ${this.opt.size.wrapperMaxHeight}px;
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
          {type: 'mousemove', el: userCanvas, callback: ev => this.updatePickLine(ev)},
          {type: 'dblclick', el: userCanvas, callback: ev => this.createPick(ev)},
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
    this.event.handlers.push(
      {type: 'keydown', el: document.body, callback: ev => this.handleKeyDown(ev)}
    )
  }

  handleKeyDown (ev) {
    if (this.opt.mode == 'list') {
      if (ev.key == 'ArrowDown') {
        this.selectNext()
      } else if (ev.key == 'ArrowUp') {
        this.selectPrev()
      }
    } else if (this.opt.mode == 'picker') {
      if (ev.key == 'Delete') {
        this.deleteSelectedPicks()
      }
    }
  }

  deleteSelectedPicks () {
    let change = false
    for (let p of this.event.selectedPick) {
      for (let wf of this.waveforms) {
        let i = wf.opt.picks.indexOf(p)
        if (i >= 0) {
          change = true
          wf.opt.picks.splice(i, 1)
        }
      }
    }
    if (change) {
      this.draw()
      if (this.opt.callback.updatePick != null) {
        this.opt.callback.updatePick.call()
      }
    }
  }

  handleWaveformMouseenter (ev) {
    let wf = this.waveforms.find(x => x.el == ev.target)
    this.event.hoverWf = wf
  }

  selectPick (ev) {
    this.event.clickPos = this.getMouseX(ev)
    this.draw()
  }

  createPick (ev) {
    if (this.event.phase != null && this.event.phase != '') {
      let ref = this.waveforms[0].opt.ttt[this.view.refTime]
      let t = this.pos2time(ref, this.getMouseX(ev))
      for (let wf of this.waveforms) {
        wf.opt.picks.push({ phase: this.event.phase, mode: 'manual', time: t })
      }
      this.event.clickPos = null
      this.draw()
      if (this.opt.callback.updatePick != null) {
        this.opt.callback.updatePick.call()
      }
    }
  }

  updatePickLine (ev) {
    if (this.event.phase != null && this.event.phase != '') {
      let pos = this.getMouseX(ev)
      let ref = this.waveforms[0].opt.ttt[this.view.refTime]
      for (let wf of this.waveforms) {
        let ctx = wf.ctx2
        ctx.clearRect(0, 0, wf.ctx2.canvas.width, wf.ctx2.canvas.height)
        ctx.save()
        ctx.textBaseline = 'top'
        ctx.fillStyle = 'black'
        ctx.fillRect(pos, 0, 1, this.opt.size.height)
        ctx.fillText(this.event.phase, pos+4, 3)
        ctx.restore()
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

  destroy () {
    for (let e of this.event.handlers) {
      e.el.removeEventListener(e.type, e.callback)
    }
    this.mainElement.parentNode.removeChild(this.mainElement)
  }

  bindEventHandlers () {
    for (let e of this.event.handlers) {
      e.el.addEventListener(e.type, e.callback)
    }
  }

  wheelHandler (ev) {
    if (ev.shiftKey) {
      ev.preventDefault()
      if (ev.ctrlKey) {
        ev.preventDefault()
        let c = Math.sign(ev.deltaY) > 0 ? 1.2 : 0.8
        this.view.gain *= c
        this.draw()
      } else {
        let sign = Math.sign(ev.deltaY == 0 ? ev.deltaX : ev.deltaY)
        this.view.duration += sign * this.view.duration * 0.2
        this.draw()
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

  selectWaveform (wf) {
    if (this.event.selectedWf != null) {
      this.event.selectedWf.el.classList.remove('selected')
    }
    this.event.selectedWf = wf
    this.event.selectedWf.el.classList.add('selected')
    if (this.opt.callback.waveformClick != null) {
      this.opt.callback.waveformClick.call(null, this.event.selectedWf.opt)
    }
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

  getXGridStepIndex () {
    let i, tickInterval = this.view.duration / (this.opt.size.width / 40); // each ticks must be separated by 40px minimum
    for (i=0; tickInterval < this.xGridScales[i]; i++);
    return i-1;
  }

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

  getStartTime (wf) {
    return wf.opt.ttt[this.view.refTime] + this.view.offset - this.view.duration/2
  }

  getEndTime (wf) {
    return wf.opt.ttt[this.view.refTime] + this.view.offset + this.view.duration/2
  }

  getStatsAndGroupData () {
    let maxAmp;
    for (let wf of this.waveforms) {
      let sppx = this.view.duration / (this.opt.size.width * wf.opt.step),
          useGrouping = true,
          i = Math.max(0, this.time2index(wf, this.getStartTime(wf))),
          iend = Math.min(wf.opt.values.length-1, this.time2index(wf, this.getEndTime(wf)));
      wf.stats = {min: null, max: null, sum: 0, count: 0, avg: null};
      wf.groupedValues = [];
      //console.log(i, iend, sppx);
      if (sppx < 3) {
        sppx = (iend - i) + 1;
        useGrouping = false;
      }
      while (i <= iend) {
        let currentGroup = wf.opt.values.slice(i, i+sppx),
            currStats = {sum: 0, count: 0};
        for (let j=0, l=currentGroup.length; j<l; j++) {
          let v = currentGroup[j];
          if (v == null) continue;
          if (currStats.min == null || v < currStats.min) currStats.min = v;
          if (currStats.max == null || v > currStats.max) currStats.max = v;
          currStats.sum += v; currStats.count++
        }
        if (currStats.min == null) wf.groupedValues.push(null);
        else {
          wf.groupedValues.push([currStats.min, currStats.max]);
          if (wf.stats.min == null || currStats.min < wf.stats.min) wf.stats.min = currStats.min;
          if (wf.stats.max == null || currStats.max > wf.stats.max) wf.stats.max = currStats.max;
          wf.stats.sum += currStats.sum; wf.stats.count += currStats.count;
        }
        i += sppx
      }
      wf.stats.avg = wf.stats.count > 0 ? wf.stats.sum / wf.stats.count : null;
      if (!useGrouping) wf.groupedValues = null;
      let amp = wf.stats.max - wf.stats.min;
      if (maxAmp == null || amp > maxAmp) maxAmp = amp;
      this.view.maxAmp = maxAmp;
    }
  }

  computeDrawOption () {
    this.view.xRatio = this.view.duration / this.opt.size.width; // s/px
    for (let wf of this.waveforms) {
      wf.drawOpt = {
        scaleGain: this.opt.equalScale ? (wf.stats.max - wf.stats.min) / this.view.maxAmp : 1,
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
      Object.assign(wf.drawOpt, {
        min: min, max : max,
        yRatio: this.opt.size.height / (max - min)
      });
    }
  }

  drawLine (wf) {
    let ctx = wf.ctx,
        x = wf.drawOpt.x0;
    ctx.save();
    ctx.strokeStyle = this.opt.color.line;
    ctx.beginPath();
    if (wf.groupedValues == null) {
      let istart = Math.max(0, this.time2index(wf, this.getStartTime(wf))),
          iend = Math.min(wf.opt.values.length-1, this.time2index(wf, this.getEndTime(wf)));
      //console.log(iend);
      let i = istart;
      for (; i<iend; i++) {
        let y = wf.opt.values[i];
        if (y != null) {
          let pos = this.value2pos(wf, y);
          if (i == istart || wf.opt.values[i-1] == null) {
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
               (tick % 100) == 0 ? d.toISOString().substr(11, 10) : '');
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
    ctx.fillStyle = '#a6dfea';
    ctx.fillRect(0, this.value2pos(wf, wf.stats.avg), this.opt.size.width, 1);
    ctx.restore();
  }

  drawVLines (wf) {
    let ctx = wf.ctx;
    if (wf.opt.ttt == null) return;
    ctx.save();
    ctx.fillStyle = this.opt.color.theoretical;
    for (let [p, t] of Object.entries(wf.opt.ttt)) {
      let pos = this.time2pos(wf.opt.ttt[this.view.refTime], t);
      if (p == 'O') {
        ctx.save();
        ctx.fillStyle = 'red';
        ctx.fillRect(pos, 0, 1, this.opt.size.height);
        ctx.restore();
      } else {
        ctx.fillRect(pos, 0, 1, this.opt.size.height);
        ctx.fillText(p, pos+3, this.opt.size.height-3);
      }
    }
    this.event.selectedPick = []
    // ctx.save()
    ctx.textBaseline = 'top'
    ctx.setLineDash([4, 1])
    // ctx.lineWidth = .5
    ctx.strokeStyle = 'gray'
    for (let p of wf.opt.picks) {
      let pos = this.time2pos(wf.opt.ttt[this.view.refTime], p.time)
      if (this.event.clickPos != null && Math.abs(this.event.clickPos - pos) < 5) {
        this.event.selectedPick.push(p)
        ctx.beginPath()
        ctx.moveTo(pos-4.5, 0)
        ctx.lineTo(pos-4.5, this.opt.size.height)
        ctx.moveTo(pos+4.5, 0)
        ctx.lineTo(pos+4.5, this.opt.size.height)
        ctx.stroke()
      }
      ctx.fillStyle = this.opt.color[p.mode]
      ctx.fillRect(pos-1, 0, 2, this.opt.size.height)
      ctx.fillText(p.phase, pos+4, 3)
    }
    ctx.restore();
  }

  draw () {
    this.clearAll();
    this.getStatsAndGroupData();
    this.computeDrawOption();
    for (let wf of this.waveforms) {
      this.drawXGrid(wf);
      if (wf.stats.count > 1) {
        this.drawAVGLine(wf);
        this.drawLine(wf);
      }
      this.drawVLines(wf);
    }
    this.drawXAxis();
  }

}
