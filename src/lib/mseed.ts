var ENCODING = [
  'ASCII', 'INT16', 'INT24', 'INT32', 'IEEE', 'IEEE_2', // 0 -> 5
  null, null, null, null,
  'STEIM1', 'STEIM2', // 10 -> 11
  'GEOSCOPE_1', 'GEOSCOPE_2', 'GEOSCOPE_3', // 12 -> 14
  'US', 'CDSN', 'Graefenberg', 'IPG', // 15 -> 18
  'STEIM3', // 19
  null, null, null, null, null, null, null, null, null, null,
  'SRO', 'HGLP', 'DWWSSN', 'RSTN' // 30 -> 33
];
var TOLERANCE = 0.005; // This define a time tolerance (as a period ratio) for continuous traces

var signedInt = function(value, size) {
  var mask = Math.pow(2, size) - 1;
  value &= mask;
  return value >> (size-1) ? -1*(~value & mask)-1 : value
};

var dataViewString = function(dv, offset, len) {
  var result = new Array(len);
  for (var i=0; i<len; i++) {
    result[i] = String.fromCharCode(dv.getUint8(offset+i))
  }
  return result.join('')
};

var Trace = function(opt) {
  this.timeseries = [];
  this.id = opt.id;
  this.sample_rate = opt.sample_rate;
  this.tolerance = 1000*TOLERANCE/opt.sample_rate;
  if (opt.data) {
    opt.data.forEach(function(data) {
      this.addData(data.starttime, data.data)
    }, this);
  }
  return this
};
Trace.prototype = {
  addData: function(starttime, data) {
    //console.log('add data, starttime='+starttime+', nb_samples='+data.length);
    var endtime = starttime + (data.length / this.sample_rate) * 1000;
    if (this.timeseries.length == 0) {
      this.timeseries.push({starttime: starttime, endtime: endtime, data: data});
      return this
    }
    // try to merge data to an existing timeseries
    for (var i=0, l=this.timeseries.length ; i<l; i++) {
      if (Math.abs(this.timeseries[i].endtime - starttime) < this.tolerance) {
        // put data at the end of the timeserie
        this.timeseries[i].data = this.timeseries[i].data.concat(data);
        this.timeseries[i].endtime = endtime;
        return this
      } else if (Math.abs(endtime - this.timeseries[i].starttime) < this.tolerance) {
        // put data at the start of the timeserie
        this.timeseries[i].data = data.concat(this.timeseries[i].data);
        this.timeseries[i].starttime = starttime;
        return this
      }
    }
    // merge failed : create new timeseries at the right place
    for (var i=0, l=this.timeseries.length ; i<l; i++) {
      if (starttime < this.timeseries[i].starttime) {
        // create timeserie before
        this.timeseries.splice(i, 0, {starttime: starttime, endtime: endtime, data: data});
        return this
      }
    }
    // create timeserie after
    this.timeseries.push({starttime: starttime, endtime: endtime, data: data});
    return this

  },
  getData: function() {
    if (this.timeseries.length == 0) return [];
    else if (this.timeseries.length == 1) return this.timeseries[0].data;
    else {
      var data = this.timeseries[0].data;
    }
    for (var i = 1; i < this.timeseries.length; i++) {
      var gap_length = (this.timeseries[i].starttime - this.timeseries[i-1].endtime)/1000;
      var nb_samples = Math.floor(gap_length * this.sample_rate);
      var begin = 0
      if (nb_samples < 0) {
        console.log(this.id+' : Warning: found overlap of '+gap_length+' seconds ('+nb_samples+') | dump duplicate data')
        begin = -1 * nb_samples
      }
      if (nb_samples > 0) {
        var d = new Date();
        d.setTime(this.timeseries[i-1].endtime);
        console.log(this.id+' : Warning: found gap of '+gap_length+' seconds ('+nb_samples+') | gap begin at '+d.toISOString());
        for (var n = 0; n < nb_samples; n++) data.push(null);
      }
      data = data.concat(this.timeseries[i].data.slice(begin));
    }
    return data
  },
  getOffset: function() {
    var all_data = [],
        nb_samples = 0;
    this.timeseries.forEach(function(ts) {all_data = all_data.concat(ts.data); nb_samples += ts.data.length});
    return Math.floor(all_data.reduce(function(x, y) {return x+y})/nb_samples)
  }
};


var Stream = function(dv, updateFunction) {
  this.trace = [];
  if (dv)
    this.parseMSEED(dv, updateFunction);
  return this
};
Stream.prototype = {
  getTrace: function(id) {for (var i=0; i<this.trace.length; i++) {if (this.trace[i].id == id) return this.trace[i]}},

  decodeFSDH: function(dv, o, byteorder) {
    var tmp = new Date();
    tmp.setTime(Date.UTC(
      dv.getUint16(o+20, byteorder), // year
      0, // january
      1, // 1st
      dv.getUint8(o+24), // hours
      dv.getUint8(o+25), // minutes
      dv.getUint8(o+26) // seconds
    ));
    tmp.setUTCDate(dv.getUint16(o+22, byteorder)); // set month and date
    var starttime = tmp.getTime() + dv.getUint16(o+28, byteorder) / 10, // add 10e-1 milliseconds
        net = dataViewString(dv, o+18, 2).trim(),
        sta = dataViewString(dv, o+8, 5).trim(),
        loc = dataViewString(dv, o+13, 2).trim(),
        cha = dataViewString(dv, o+15, 3),
        sr_f = dv.getInt16(o+32, byteorder),// sample rate factor
        sr_m = dv.getInt16(o+34, byteorder),// sample rate multiplier
        act_flags = dv.getUint8(o+36),// activity flags
        t_corr = dv.getInt32(o+40, byteorder)/10;
    if ((act_flags & 2) == 0) starttime += t_corr;// apply time correction if needed
    var val = sr_m < 0 ? sr_f/sr_m : sr_f*sr_m;
    if (sr_f < 0) val = 1/val;
    return {
      seed_id:         [net, sta, loc, cha].join('.'),
      starttime:       starttime,
      npts:            dv.getUint16(o+30, byteorder),
      sample_rate:     Math.abs(val),
      data_begin:      dv.getUint16(o+44, byteorder),
      first_blockette: dv.getUint16(o+46, byteorder)
    }
  },

  decodeBlkt1000: function(dv, o, byteorder) {
    return {
      next_bloquette: dv.getUint16(o+2, byteorder),
      encoding: dv.getUint8(o+4),
      little_endian: dv.getUint8(o+5) === 0,
      packet_size: Math.pow(2, dv.getUint8(o+6))
    }
  },

  decodeBlkt100: function(dv, o, byteorder) {
    return {
      next_bloquette: dv.getUint16(o+2, byteorder),
      actual_sample_rate: dv.getFloat32(o+4, byteorder)
    }
  },

  decodeINT16: function(dv, h, index) {
    var o = index+h.fsdh.data_begin,
        data = new Array(h.fsdh.npts);
    for (var i=0; i<h.fsdh.npts; data[i]=dv.getInt16(o+i*2, h.blkt1000.little_endian), i++);
    return data
  },
  decodeINT32: function(dv, h, index) {
    var o = index+h.fsdh.data_begin,
        data = new Array(h.fsdh.npts);
    for (var i=0; i<h.fsdh.npts; data[i]=dv.getInt32(o+i*4, h.blkt1000.little_endian), i++);
    return data
  },
  decodeIEEE32: function(dv, h, index) {
    var o = index+h.fsdh.data_begin,
        data = new Array(h.fsdh.npts);
    for (var i=0; i<h.fsdh.npts; data[i]=dv.getFloat32(o+i*4, h.blkt1000.little_endian), i++);
    return data
  },
  decodeIEEE64: function(dv, h, index) {
    var o = index+h.fsdh.data_begin,
        data = new Array(h.fsdh.npts);
    for (var i=0; i<h.fsdh.npts; data[i]=dv.getFloat64(o+i*8, h.blkt1000.little_endian), i++);
    return data
  },

  decodeSteim: function(v, dv, h, index) {
    var o = index + h.fsdh.data_begin;
    var nb_frame = (h.blkt1000.packet_size - h.fsdh.data_begin) / 64,
        fi, w0, shift, fic, ric, wi, nib, dnib,
        d = new Array(h.fsdh.npts), dc = 0,// dc for "diff count"
        s = new Array(h.fsdh.npts),
        swapflag = h.blkt1000.little_endian;
    for (var fc=0; fc<nb_frame; fc++) {// fc for "frame count"
      fi = o + fc * 64;// fi = "frame index" (a frame is 64byte long)
      wi = 4; // wi for "word index"
      shift = 28;
      if (fc == 0) {// the 1st frame contains the fic and ric values
        fic = dv.getInt32(fi+wi, swapflag);
        ric = dv.getInt32(fi+wi+4, swapflag);
        wi = 12;
        s[0] = fic;
        shift = 24;
      }
      w0 = dv.getUint32(fi, swapflag);// w0 (word 0) contains 16 x 2bit nibbles
      while (shift >= 0) {
        nib = w0 >> shift & 3; // the nibble contains a code that indicates the diffs size of its associated word in the frame
        switch(nib) {
          case 0: break;// no data
          case 1: for (var i=0; i<4; d[dc] = dv.getInt8(fi+wi+i), dc++, i++); break;// 4 x 8bit diffs
          case 2:
            if (v == 1) for (var i=0; i<2; d[dc] = dv.getInt16(fi+wi+2*i, swapflag), dc++, i++);// 2 x 16bit diffs (STEIM1)
            else {// STEIM2
              var wk = dv.getUint32(fi+wi, swapflag);
              dnib = wk >> 30 & 3;
              switch(dnib) {
                case 1: d[dc++] = signedInt(wk, 30); break;// 1 x 30bit diff
                case 2: for (var i=1; i>=0; d[dc] = signedInt(wk >> 15*i, 15), dc++, i--); break;// 2 x 15bit diffs
                case 3: for (var i=2; i>=0; d[dc] = signedInt(wk >> 10*i, 10), dc++, i--); break;// 3 x 10bit diffs
              }
            }
            break;
          case 3:
            if (v == 1) d[dc++] = dv.getInt32(fi+wi, swapflag);// 1 x 32bit diff (STEIM1)
            else {// STEIM2
              var wk = dv.getUint32(fi+wi, swapflag);
              dnib = wk >> 30 & 3;
              switch(dnib) {
                case 0: for (var i=4; i>=0; d[dc] = signedInt(wk >> 6*i, 6), dc++, i--); break;// 5 x 6bit diffs
                case 1: for (var i=5; i>=0; d[dc] = signedInt(wk >> 5*i, 5), dc++, i--); break;// 6 x 5bit diffs
                case 2: for (var i=6; i>=0; d[dc] = signedInt(wk >> 4*i, 4), dc++, i--); break;// 7 x 4bit diffs
              }
            }
            break;
        }
        wi += 4;
        shift -= 2;
      }
    }
    for (var i=1, l=h.fsdh.npts; i<l; s[i] = s[i-1] + d[i], i++);
    if (s[s.length-1] != ric)
      console.log('Decoding error: last sample computed ('+s[s.length-1]+') does not match RIC ('+ric+') '+'(packet index : '+index+'),'+h.fsdh.seed_id);
    return s
  },

  _sortTrace: function() {
    this.trace.sort(function(a, b) {
      if (a.id < b.id) return -1;
      else if (a.id > b.id) return 1;
      return 0
    });
    return this
  },

  _is_year_day_valid: function(dv, index) {
    var year = dv.getUint16(index+20),
        julday = dv.getUint16(index+22);
    if (year >= 1900 && year <= 2100 && julday >=1 && julday <= 366) {
      return true
    }
    return false
  },

  parseMSEED: function(dv, updateFunction) {
    var index = 0, packet_count = 0,
        data, trace;
    while (index < dv.byteLength) {
      if (updateFunction !== undefined) updateFunction.call(null, {
        percent: 100*(index/dv.byteLength)
      });
      var byteorder;
      var h = {}; // object that contains fsdh and all bloquettes
      // decode Fixed Section of Data Header
      if (this._is_year_day_valid(dv, index)) {
        byteorder = false
      } else {
        byteorder = true;//set the byteorder to little endian
      }
      h.fsdh = this.decodeFSDH(dv, index, byteorder);
      // decode bloquette(s)
      var next_bloquette = h.fsdh.first_blockette;
      while (next_bloquette > 0) {
        var blkt_code = dv.getUint16(index+next_bloquette, byteorder);
        if (blkt_code == 100) {
          h.blkt100 = this.decodeBlkt100(dv, index+next_bloquette, byteorder);
          next_bloquette = h.blkt100.next_bloquette
          console.log(`Ignore "actual" sample rate (${h.blkt100.actual_sample_rate}) and use sample rate in FSDH (${h.fsdh.sample_rate})`)
        } else if (blkt_code == 1000) {
          h.blkt1000 = this.decodeBlkt1000(dv, index+next_bloquette, byteorder);
          byteorder = h.blkt1000.little_endian;
          next_bloquette = 0;
        } else if (blkt_code == 1001) {
          // bloquette 1001 is ignored
          next_bloquette = dv.getUint16(index+next_bloquette+2, byteorder);
        } else {
          throw new Error('Unhandled bloquette type '+blkt_code+' (packet index : '+index+')');
        }
      }
      // decode data
      switch (h.blkt1000.encoding) {
        case 1: data = this.decodeINT16(dv, h, index); break;
        case 3: data = this.decodeINT32(dv, h, index); break;
        case 4: data = this.decodeIEEE32(dv, h, index); break;
        case 5: data = this.decodeIEEE64(dv, h, index); break;
        case 10: data = this.decodeSteim(1, dv, h, index); break;
        case 11: data = this.decodeSteim(2, dv, h, index); break;
        default: throw new Error('Not supported encoding "'+ENCODING[h.blkt1000.encoding]+'" (packet index: '+index+')');
      }

      if (data.length != h.fsdh.npts)
        console.log(data.length+' samples retrieved instead of '+h.fsdh.npts+' expected');
      // retrieve trace if exists
      trace = this.getTrace(h.fsdh.seed_id);
      if (trace) trace.addData(h.fsdh.starttime, data); // add data to the existing Trace
      else this.trace.push(new Trace({
        id: h.fsdh.seed_id,
        sample_rate: h.fsdh.sample_rate,
        data: [{starttime: h.fsdh.starttime, data: data}]
      })); // create a new Trace

      index += h.blkt1000.packet_size;
      packet_count++;
    }
    this._sortTrace();
    return this
  }
};

export default {
  Trace: Trace,
  Stream: Stream
}
