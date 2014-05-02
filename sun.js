(function () {
  var up = function (a, b) {
    for (var k in b)
      a[k] = b[k];
    return a;
  }
  var cls = function (cons) {
    [].slice.call(arguments, 1).map(function (base) { up(cons.prototype, base) })
    return cons;
  }
  var int = function (x) { return parseInt(x, 10) }
  var sgn = function (x) { return x < 0 ? -1 : 1 }
  var add = function (x, y) { return x + y }
  var max = function (x, y) { return x > y ? x : y }
  var min = function (x, y) { return x < y ? x : y }
  var mod = function (x, y) {
    var r = x % y;
    return r < 0 ? r + y : r;
  }
  var pad = function (s, opt) {
    var s = s + '', w = opt && opt.width || 2, p = opt && opt.pad || '0';
    while (s.length < w)
      s = p + s;
    return s;
  }
  var nchoosek = function (n, k) {
    var c = 1, d = 1;
    for (var i = n; i > k; i--) {
      c *= i;
      d *= n - i + 1;
    }
    return c / d;
  }
  var bezier = function (t, P) {
    var n = P.length - 1, x = 0, y = 0;
    for (i = 0; i <= n; i++) {
      var p = P[i], w = nchoosek(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i)
      x += w * (p[0] || 0)
      y += w * (p[1] || 0)
    }
    return [x, y];
  }

  Sun = {
    up: up,
    cls: cls,
    int: int,
    sgn: sgn,
    add: add,
    max: max,
    min: min,
    mod: mod,
    pad: pad,
    nchoosek: nchoosek,
    bezier: bezier,
    clockdist: function (a, b, c) {
      return min(mod(a - b, c || 24), mod(b - a, c || 24))
    },
    ellipsis: function (text, n) {
      if (n && text.length > n + 3)
        return text.substr(0, n) + '\u2026';
      return text;
    },
    count: function (fun, acc, opt) {
      var o = up({start: 0, step: 1, stop: isFinite(opt) ? opt : undefined}, opt)
      var f = o.start + o.step >= o.start;
      for (var i = o.start; f ? i < o.stop : i > o.stop; i += o.step)
        acc = fun(acc, i, o)
      return acc;
    },
    range: function (opt) {
      return Sun.count(L.append, [], opt)
    },
    fold: function (fun, acc, obj) {
      if (obj && obj.reduce)
        return obj.reduce(fun, acc)
      var i = 0;
      for (var k in obj)
        acc = fun(acc, [k, obj[k]], i++, obj)
      return acc;
    },
    format: function (fmt, arg) {
      return fmt.replace(/{(.*?)}/g, function(m, k) { return k in arg ? arg[k] : m })
    },
    object: function (iter) {
      return Sun.fold(function (o, i) { return (o[i[0]] = i[1]), o }, {}, iter)
    },
    repeat: function (fun, every) {
      return fun() || setTimeout(function () {
        fun() || setTimeout(arguments.callee, every)
      }, every)
    }
  }

  Sun.Cage = function Cage(obj, opt) {
    this.__opt__ = up({sep: /\s+/}, opt)
    this.__obj__ = obj || this;
    this.__fns__ = {}
  }
  up(Sun.Cage.prototype, {
    change: function (k, v) {
      var u = this.__obj__[k]
      this.__obj__[k] = v;
      this.trigger(k, v, u)
      return v;
    },
    update: function (obj) {
      for (var k in obj)
        this.change(k, obj[k])
      return this;
    },
    on: function (keys, fun) {
      var fns = this.__fns__, sep = this.__opt__.sep;
      keys.split(sep).map(function (k) { (fns[k] = fns[k] || []).push(fun) })
      return this;
    },
    off: function (keys, fun) {
      var fns = this.__fns__, sep = this.__opt__.sep;
      keys.split(sep).map(function (k) {
        var i = (fns[k] || []).indexOf(fun)
        if (i >= 0)
          delete fns[k][i]
      })
      return this;
    },
    once: function (keys, fun) {
      var n = 0;
      return this.til(keys, fun, function () { return n++ })
    },
    til: function (keys, fun, dead) {
      this.on(keys, function () {
        if (dead())
          this.off(keys, arguments.callee)
        else
          fun.apply(this, arguments)
      })
    },
    trigger: function (key, val, old) {
      var self = this;
      return (self.__fns__[key] || []).map(function (f) { f.call(self, val, old, key) })
    }
  })

  Sun.form = {
    encode: function (obj) {
      var list = [];
      for (var k in obj)
        list.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));
      return list.join('&');
    },
    decode: function (str) {
      var list = str ? str.split('&') : [];
      return list.reduce(function (acc, item) {
        var kv = item.split('=').map(decodeURIComponent);
        acc[kv[0]] = kv[1];
        return acc;
      }, {});
    }
  }

  var H = Sun.http = up(function (method, url, fun, data, hdrs) {
    var req = new XMLHttpRequest()
    req.onreadystatechange = function () {
      if (this.readyState == this.DONE){
        fun(this)
      }
    };
    req.open(method, url, true)
    Sun.fold(function (_, o) { req.setRequestHeader(o[0], o[1]) }, null, hdrs)
    req.send(data)
    return req;
  }, {
    get:  function (url, fun, hdrs)       { return H("GET",  url, fun, null, hdrs) },
    put:  function (url, fun, data, hdrs) { return H("PUT",  url, fun, data, hdrs) },
    post: function (url, fun, data, hdrs) { return H("POST", url, fun, data, hdrs) }
  })

  var L = Sun.lists = {
    last: function (list, n) { return list[list.length - (n || 1)] },
    append: function (list, item) { return list.push(item) && list },
    drop: function (list, item) {
      var i = list.indexOf(item)
      if (i >= 0)
        return list.splice(i, 1)[0]
    },
    groupby: function (list, key) {
      var k, key = key || function (item) { return item[0] }
      return list.reduce(function (acc, item) {
        var k_ = key(item)
        if (k_ == k)
          acc[acc.length - 1][1].push(item)
        else
          acc.push([k_, [item]])
        k = k_;
        return acc;
      }, [])
    },
    unique: function (list, key) {
      var keys = {}, key = key || function (item) { return item }
      return list.reduce(function (acc, item) {
        var k = key(item)
        if (k in keys)
          return acc;
        keys[k] = true;
        return acc.push(item), acc;
      }, [])
    },
    insert: function (list, item, lte) {
      var lte = lte || function (a, b) { return a <= b }
      for (var i = 0; i < list.length; i++)
        if (lte(item, list[i]))
          return list.splice(i, 0, item) && list;
      return list.push(item) && list;
    },
    keyindex: function (list, val, key, eq) {
      var eq = eq || function (a, b) { return a <= b && a >= b }
      for (var i = 0, k = key || 0; i < list.length; i++) {
        var v = list[i][k];
        if (eq(v, val))
          return i;
      }
    },
    keydrop: function (list, val, key, eq) {
      var i = L.keyindex(list, val, key, eq)
      if (i >= 0)
        return list.splice(i, 1)[0]
    },
    keyfind: function (list, val, key, eq) {
      var i = L.keyindex(list, val, key, eq)
      if (i >= 0)
        return list[i];
    },
    keystore: function (list, val, rep, key, eq) {
      var i = L.keyindex(list, val, key, eq)
      if (i >= 0)
        return list[i] = rep;
      return list.push(rep) && rep;
    },
    umerge: function (x, y, lt) {
      var lt = lt || function (a, b) { return a < b }
      var z = [], i = 0, j = 0, l;
      while (i < x.length || j < y.length) {
        if (j >= y.length || lt(x[i], y[j])) {
          if (lt(l, x[i]) || !(i || j))
            z.push(l = x[i])
          i++;
        }
        else {
          if (lt(l, y[j]) || !(i || j))
            z.push(l = y[j])
          j++;
        }
      }
      return z;
    },
    values: function (obj) {
      var vals = [];
      for (var k in obj)
        vals.push(obj[k])
      return vals;
    }
  }

  var Sec = 1000, Min = 60 * Sec, Hour = 60 * Min, Day = 24 * Hour, Week = 7 * Day;
  var DoW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MoY = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var T = Sun.time = up(function (set, rel) {
    var rel = rel ? new Date(rel) : new Date, set = set || {};
    return new Date(set.y == undefined ? rel.getFullYear() : set.y,
                    set.m == undefined ? rel.getMonth() : set.m,
                    set.d == undefined ? rel.getDate() : set.d,
                    set.h == undefined ? rel.getHours() : set.h,
                    set.mi == undefined ? rel.getMinutes() : set.mi,
                    set.s == undefined ? rel.getSeconds() : set.s,
                    set.ms == undefined ? rel.getMilliseconds() : set.ms)
  }, {
    get: function (k, rel) {
      var rel = rel ? new Date(rel) : new Date;
      switch (k) {
        case 'y': return rel.getFullYear()
        case 'm': return rel.getMonth()
        case 'd': return rel.getDate()
        case 'h': return rel.getHours()
        case 'mi': return rel.getMinutes()
        case 's': return rel.getSeconds()
        case 'ms': return rel.getMilliseconds()
      }
    },
    pass: function (dif, rel) {
      var rel = rel ? new Date(rel) : new Date;
      for (var k in dif)
        switch (k) {
        case 'y': rel.setFullYear(rel.getFullYear() + dif[k]); break;
        case 'm': rel.setMonth(rel.getMonth() + dif[k]); break;
        case 'w': rel.setDate(rel.getDate() + dif[k] * 7); break;
        case 'd': rel.setDate(rel.getDate() + dif[k]); break;
        case 'h': rel.setHours(rel.getHours() + dif[k]); break;
        case 'mi': rel.setMinutes(rel.getMinutes() + dif[k]); break;
        case 's': rel.setSeconds(rel.getSeconds() + dif[k]); break;
        case 'ms': rel.setMilliseconds(rel.getMilliseconds() + dif[k]); break;
        }
      return rel;
    },
    fold: function (fun, acc, opt) {
      var t = opt.start || new Date, stop = opt.stop, step = opt.step || {d: 1};
      var f = T.pass(step, t) >= t, jump = {};
      for (var i = 1, s = t; !stop || (f ? (t < stop) : (t > stop)); i++) {
        acc = fun(acc, t)
        for (var k in step)
          jump[k] = step[k] * i;
        t = T.pass(jump, s)
      }
      return acc;
    },
    parse: function (stamp, opt) {
      var opt = opt || {};
      var sep = opt.sep || 'T', dsep = opt.dsep || '-', tsep = opt.tsep || ':';
      var utc = opt.utc || stamp[stamp.length - 1] == 'Z';
      var dtp = stamp.split(sep)
      var datep = dtp[0] ? dtp[0].split(dsep).map(int) : [0, 0, 0];
      var timep = dtp[1] ? dtp[1].substring(0, 8).split(':').map(int) : [0, 0, 0];
      if (utc)
        return new Date(Date.UTC(datep[0], datep[1] - 1, datep[2], timep[0], timep[1], timep[2]))
      return new Date(datep[0], datep[1] - 1, datep[2], timep[0], timep[1], timep[2])
    },
    datestamp: function (t) {
      return t.getFullYear() + '/' + pad(t.getMonth() + 1) + '/' + pad(t.getDate())
    },
    timestamp: function (t) {
      return pad(t.getHours()) + ':' + pad(t.getSeconds()) + ':' + pad(t.getMinutes())
    },
    stamp: function (t) { return T.datestamp(t) + ' ' + T.timestamp(t) },
    fromGregorian: function (s) { return new Date((s - 62167219200) * 1000) },
    toGregorian: function (t) { return ~~(t / 1000) + 62167219200 },
    daysInMonth: function (y, m) { return 32 - new Date(y, m, 32).getDate() },
    isLeapYear: function (y) { return !(y % 4) && ((y % 100) != 0 || !(y % 400)) },
    weekday: function (t) { return DoW[t.getDay()] },
    month: function (t) { return MoY[t.getMonth()] },
    DoW: DoW,
    MoY: MoY,
    Sec: Sec,
    Min: Min,
    Hour: Hour,
    Day: Day,
    Week: Week
  })
})();
