(function (root, factory) {
  if(typeof define === "function" && define.amd) {
    //define('simplechart', ['abstractevents'], factory);
    define('waveform', [], factory);
  } else if(typeof module === "object" && module.exports) {
    //module.exports = factory(require('abstractevents'));
    module.exports = factory();
  } else {
    //root.SimpleChart = factory(root.AbstractEvents);
    root.Waveform = factory();
  }
}(this, function(arg1) {
  // check dependencies
  /*
  if (typeof jQuery === 'undefined') {throw new ReferenceError('jQuery is not loaded')}
  if (typeof AbstractEvents === 'undefined') {throw new ReferenceError('AbstractEvents is not loaded')}
  */

  class Waveform {

    constructor (opt) {
      this.xGridScales = [
        31536000000, 15768000000,                       // >/= 6 months
        4838400000, 2419200000, 604800000,              // >/= 7days
        172800000, 86400000,                            // >/= 1 day
        43200000, 21600000, 14400000, 7200000, 3600000, // >/= 1 hour
        1800000, 600000, 300000, 120000, 60000,         // >/= 1 minute
        30000, 10000, 5000, 2000, 1000,                 // >/= 1 seconde
        500, 200, 100                                   // < 1 seconde
      ];
      this.event = {};
      this.loadOptions(opt);
      this.initStructure();
      this.draw();
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
      this.view.refTime = ref;
      this.view.offset = ref == 'O' ? this.view.duration/2 : 0;
    }

    time2index (wf, t) {
      return Math.floor((t - wf.start) / wf.step)
    }

    time2pos (ref, t) {
      return this.opt.size.width/2 + (t-ref-this.view.offset)/this.view.xRatio
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
        waveforms : [],/*[
          {
            start: <js_timestamp>,
            step: <number>,
            values: [],
            id: 'XX.NOISE.00.HHZ',
            distance: <number>,
            ttt: {P: <js_timestamp>}, // ttt = "theoritical travel time"
            markers: [{phase: 'P', time: <js_timestamp>}]
          }
        ]*/
        /* optional */
        // -- style --
        size: {
          height: 60,// the height of a single waveform
          width: null,
          font: 10
        },
        color: {
          text: 'rgb(150,150,150)',
          //line: 'rgb(126,195,252)',
          line: 'gray',
          grid: 'rgba(180,180,180,.3)',
          border: 'gray'
        },
        callback: {
          waveformClick: null
        },
        equalScale: false
      };
      // merge default options with given options
      this.recursiveCopy(this.opt, opt);
      // retrieve a DOMElement if a selector string was given
      if (typeof this.opt.container == 'string') {
        this.opt.container = document.querySelector(this.opt.container)
      }
      // get the width of the container if not given in option
      if (this.opt.size.width === null) {
        let pad = window.getComputedStyle(this.opt.container).padding;
        this.opt.size.width = this.opt.container.clientWidth - 2 * parseInt(pad == '' ? 0 : pad)
      }
      let start, end;
      for (let wf of this.opt.waveforms) {
        let currStart = Math.min(wf.start, wf.ttt.O),
            currEnd = Math.max(wf.start+wf.values.length*wf.step, wf.ttt.O);
        if (start == null || currStart < start) start = currStart;
        if (end == null || currEnd > end) end = currEnd;
      }
      this.view = {
        refTime: 'O',
        duration: end-start,
        gain: 1
      };
      this.view.offset = this.view.duration/2
    }

    initStyle () {
      let styleId = 'waveform-style';
      if (document.getElementById(styleId) == null) {
        let s = document.createElement('style');
        s.id = styleId;
        s.innerText = `
          .trace-container {overflow-x: hidden; overflow-y: auto; max-height: 400px}
          .wf-container {position: relative;}
          .wf-container:nth-child(even) {background: #efefef;}
          .wf-canvas {position: absolute; top: 0; left: 0; z-index: 0;}
          .wf-label-container {position: absolute; top: 0; left: 0; background: rgba(127,127,127,.8); z-index: 10; width: 100px}
          .wf-label {font-family: sans-serif; color: white; font-size: 10px; margin: 5px}`;
        document.body.appendChild(s);
      }
    }

    initStructure () {
      /*
      mainElement
          |-> traceContainer
          |        |->  wfContainer
          |        :         |-> wfCanvas
          |                  `-> wfLabelContainer
          |                             `-> wfLabel
          `-> xAxis
      */
      this.initStyle();
      this.waveformClickHandler = ev => {
        if (this.event.x == null && this.opt.callback.waveformClick != null) {
          this.opt.callback.waveformClick.call(null, ev.target.dataset.wfid);
        }
      };
      let attachWaveformClickHandler = (canvas, wf) => {
        canvas.addEventListener('click', this.waveformClickHandler)
      }
      let mainElement = document.createElement('div'),
          traceContainer = document.createElement('div'),
          xAxis = document.createElement('canvas');
      xAxis.width = this.opt.size.width;
      xAxis.height = 40;
      mainElement.appendChild(traceContainer);
      mainElement.appendChild(xAxis);
      traceContainer.className = 'trace-container';
      //Object.assign(traceContainer.style, {overflowX: 'hidden', overflowY: 'auto', maxHeight: '400px'});
      for (let i=0, l=this.opt.waveforms.length; i<l; i++) {
        let wf = this.opt.waveforms[i],
            wfContainer = document.createElement('div'),
            wfCanvas = document.createElement('canvas'),
            wfLabelContainer = document.createElement('div'),
            wfLabel = document.createElement('div');
        traceContainer.appendChild(wfContainer);
        wfContainer.appendChild(wfCanvas);
        wfContainer.appendChild(wfLabelContainer);
        wfLabelContainer.appendChild(wfLabel);
        wfContainer.className = 'wf-container';
        wfContainer.style.height = `${this.opt.size.height}px`;
        wfLabelContainer.style.height = `${this.opt.size.height}px`;
        wfLabel.className = 'wf-label';
        /*Object.assign(wfContainer.style, {
          position: 'relative', height: `${this.opt.size.height}px`,
          background: i%2 == 0 ? '#fff' : '#efefef'
        });*/
        wfCanvas.className = 'wf-canvas';
        wfLabelContainer.className = 'wf-label-container';
        /*Object.assign(wfCanvas.style, {position: 'absolute', top: '0px', left: '0px', zIndex: 0});
        Object.assign(wfLabelContainer.style, {
          position: 'absolute', top: '0px', left: '0px',
          background: 'rgba(127,127,127,.8)', zIndex: 10,
          width: '100px', height: `${this.opt.size.height}px`
        });
        Object.assign(wfLabel.style, {
          fontFamily: 'sans-serif', color: 'white',  fontSize: '10px',
          margin: '5px'
        });*/
        wfLabel.innerHTML = `<strong>${wf.id}</strong>`;
        wfCanvas.width = this.opt.size.width;
        wfCanvas.height = this.opt.size.height;
        wfCanvas.dataset.wfid = wf.id;
        wf.ctx = wfCanvas.getContext('2d');
        attachWaveformClickHandler(wfCanvas, wf);
      }
      this.mainElement = mainElement;
      this.xAxis = xAxis.getContext('2d');
      this.opt.container.appendChild(mainElement);
      this.bindEventHandlers();
    }

    sortWaveformsBy(keyAccesor) {
      let traceContainer = this.mainElement.children[0];
      this.opt.waveforms.sort((a, b) => {
        a = keyAccesor(a);
        b = keyAccesor(b);
        return a == b ? 0 : a < b ? -1 : 1
      });
      for (let wf of this.opt.waveforms) {
        traceContainer.appendChild(wf.ctx.canvas.parentNode)
      }
    }

    destroy () {
      for (let [e, h] of Object.entries(this.handlers)) {
        this.mainElement.removeEventListener(e, h)
      }
      this.mainElement.parentNode.removeChild(this.mainElement)
    }

    bindEventHandlers () {
      this.handlers = {
        wheel: ev => this.wheelHandler(ev),
        mousedown: ev => this.mouseDownHandler(ev),
        mousemove: ev => this.mouseMoveHandler(ev),
        mouseup: ev => this.mouseUpHandler(ev)
      };
      for (let [e, h] of Object.entries(this.handlers)) {
        this.mainElement.addEventListener(e, h)
      }
    }

    wheelHandler (ev) {
      if (ev.shiftKey) {
        ev.preventDefault();
        let sign = Math.sign(ev.deltaY == 0 ? ev.deltaX : ev.deltaY);
        this.view.duration += sign * this.view.duration * 0.2;
        this.draw();
      } else if (ev.ctrlKey) {
        ev.preventDefault();
        let c = Math.sign(ev.deltaY) > 0 ? 1.2 : 0.8;
        this.view.gain *= c;
        this.draw();
      }
    }

    mouseDownHandler (ev) {
      ev.preventDefault();
      this.event.x = ev.clientX;
    }

    mouseMoveHandler (ev) {
      let pos = ev.clientX;
      if (this.event.x != null) {
        let delta = this.event.x - pos;
        if (Math.abs(delta) > 5) {
          this.event.x = pos;
          let sign = Math.sign(delta),
              deltaT = Math.abs(delta) * this.view.xRatio;
          this.view.offset += deltaT*sign
          this.draw()
        }
      }
    }

    mouseUpHandler (ev) {
      if (this.event.x != null) {
        delete this.event.x
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
        ctx.fillRect(this.time2pos(wf.ttt[this.view.refTime], tick), 0, 1, this.opt.size.height);
        tick += tickStep
      }
      ctx.restore();
    }

    getStartTime (wf) {
      return wf.ttt[this.view.refTime] + this.view.offset - this.view.duration/2
    }

    getEndTime (wf) {
      return wf.ttt[this.view.refTime] + this.view.offset + this.view.duration/2
    }

    getStatsAndGroupData () {
      let maxAmp;
      for (let wf of this.opt.waveforms) {
        let sppx = this.view.duration / (this.opt.size.width * wf.step),
            useGrouping = true,
            i = Math.max(0, this.time2index(wf, this.getStartTime(wf))),
            iend = Math.min(wf.values.length-1, this.time2index(wf, this.getEndTime(wf)));
        wf.stats = {min: null, max: null, sum: 0, count: 0, avg: null};
        wf.groupedValues = [];
        //console.log(i, iend, sppx);
        if (sppx < 3) {
          sppx = (iend - i) + 1;
          useGrouping = false;
        }
        while (i <= iend) {
          let currentGroup = wf.values.slice(i, i+sppx),
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
      for (let wf of this.opt.waveforms) {
        wf.drawOpt = {
          scaleGain: this.opt.equalScale ? (wf.stats.max - wf.stats.min) / this.view.maxAmp : 1,
          step: wf.step / this.view.xRatio,
          x0: 0
        };
        if (this.getStartTime(wf) < wf.start) {
          wf.drawOpt.x0 = this.time2pos(wf.ttt[this.view.refTime], wf.start);
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
            iend = Math.min(wf.values.length-1, this.time2index(wf, this.getEndTime(wf)));
        //console.log(iend);
        let i = istart;
        for (; i<iend; i++) {
          let y = wf.values[i];
          if (y != null) {
            let pos = this.value2pos(wf, y);
            if (i == istart || wf.values[i-1] == null) {
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
      for (let wf of this.opt.waveforms) {
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
      ctx.fillStyle = 'gray';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillRect(0, 0, ctx.canvas.width, 1);
      let refTime = this.view.refTime == 'O' ? this.opt.waveforms[0].ttt.O : 0;
      let start = refTime + this.view.offset - this.view.duration/2;
      let tick = start - (start % minorTick) + minorTick;
      while (tick-start < this.view.duration) {
        let pos = this.time2pos(refTime, tick);
        if (tick % majorTick == 0) {
          ctx.fillRect(pos, 0, 1, 8);
          d.setTime(tick);
          let t = tick/1000;
          if (this.view.refTime == 'O') {
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

    drawTTT (wf) {
      let ctx = wf.ctx;
      if (wf.ttt == null) return;
      ctx.save();
      ctx.fillStyle = 'blue';
      for (let [p, t] of Object.entries(wf.ttt)) {
        let pos = this.time2pos(wf.ttt[this.view.refTime], t);
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
      ctx.restore();
    }

    draw () {
      this.clearAll();
      this.getStatsAndGroupData();
      this.computeDrawOption();
      for (let wf of this.opt.waveforms) {
        this.drawXGrid(wf);
        if (wf.stats.count > 1) {
          this.drawAVGLine(wf);
          this.drawLine(wf);
        }
        this.drawTTT(wf);
      }
      this.drawXAxis();
    }

  }

  return Waveform
}));
