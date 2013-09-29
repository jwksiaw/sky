(function () {
  var def = Sky.util.def, clip = Sky.util.clip, up = Sky.util.update;
  var log = Math.log, sgn = function (x) { return x < 0 ? -1 : 1 }
  var cat = function (a, b) { return b ? [].concat(a, b) : a }

  Orb = function Orb(obj, jack, elem) {
    this.update(obj);
    this.jack = jack || this.jack;
    this.elem = elem || this.elem;
    this.grip = 0;
  }
  Orb.prototype.update = function (obj) { return up(this, obj) }
  Orb.prototype.update({
    prop: function (f, a) { return Orb.do(this.jack, f, a) },
    push: function () { return this.prop('move', arguments) },
    grab: function () { this.grip++; return this.prop('grab') },
    free: function () { this.grip--; return this.prop('free') },
    move: function () { return this.prop('move', arguments) },
  });
  Orb = up(Orb, {
    do: function (o, f, a) {
      if (o) {
        if (o[f])
          return o[f].apply(o, a);
        if (o instanceof Array)
          return o.reduce(function (_, i) { return Orb.do(i, f, a) }, 0);
      }
    },
    grab: function (o) { return Orb.do(o, 'grab') },
    free: function (o) { return Orb.do(o, 'free') },
    move: function (o, dx, dy, a, r, g, s) {
      return Orb.do(o, 'move', [dx || 0, dy || 0, a, r, g, s]);
    },
    init: function (o) { Orb.call(o); return o },
    type: function (cons, proto) {
      cons.prototype = new Orb().update(proto);
      cons.prototype.constructor = cons;
      return function (a, r, g, s) { return Orb.init(new cons(this, a, r, g, s)) }
    }
  });

  Sky.Elem.prototype.update({
    dbltap: function (fun, opts) {
      var opts = up({gap: 250}, opts);
      var taps = 0;
      this.on('mouseup touchend', function () {
        if (taps++)
          fun();
        setTimeout(function () { taps = 0 }, opts.gap);
      });
      return this;
    },

    press: function (o, opts) {
      var opts = up({gain: 1, every: 1}, opts);
      var press, i;
      this.on('mousedown touchstart', function () {
        if (!press)
          Orb.grab(o);
        press = true;
        i = setInterval(function () { Orb.move(o, opts.gain) }, opts.every);
      });
      this.doc().on('mouseup touchend', function () {
        if (press)
          Orb.free(o);
        press = false;
        clearInterval(i);
      });
      return this;
    },
    swipe: function (o, opts) {
      var opts = up({glob: true}, opts);
      var glob = opts.glob, stop = opts.stop;
      var swipe, lx, ly;
      var doc = this.doc(), that = glob ? doc : this;
      this.on('mousedown touchstart', function (e) {
        var t = e.touches ? e.touches[0] : e;
        if (!swipe)
          Orb.grab(o);
        swipe = true;
        lx = t.pageX;
        ly = t.pageY;
      });
      that.on('mousemove touchmove', function (e) {
        if (swipe) {
          var t = e.touches ? e.touches[0] : e;
          Orb.move(o, t.pageX - lx, t.pageY - ly, lx, ly, t.pageX, t.pageY);
          lx = t.pageX;
          ly = t.pageY;
          if (stop)
            e.stopImmediatePropagation();
          e.preventDefault();
        }
      });
      doc.on('mouseup touchend', function () {
        if (swipe)
          Orb.free(o);
        swipe = false;
      });
      return this;
    },
    scroll: function (o, opts) {
      var opts = up({}, opts);
      var stop = opts.stop;
      return this.on('mousewheel', function (e) {
        Orb.move(o, e.wheelDeltaX, e.wheelDeltaY);
        if (stop)
          e.stopImmediatePropagation();
        e.preventDefault();
      }).swipe(o, opts);
    },

    spring: Orb.type(function Spring(elem, jack, opts) {
      var opts = up({}, opts);
      var kx = opts.kx || 8, ky = opts.ky || 8;
      var restore = opts.restore || function (dx, dy, mx, my) {
        if (mx > 1) dx /= kx * log(mx + 1);
        if (my > 1) dy /= ky * log(my + 1);
        this.dx -= dx;
        this.dy -= dy;
        return this.push(dx, dy, this);
      }
      var stretch = opts.stretch, balance = opts.balance, perturb = opts.perturb;
      var anim;

      this.dx = 0;
      this.dy = 0;
      this.elem = elem;
      this.jack = jack;
      this.move = function (dx, dy) {
        var s = this;
        s.dx += dx;
        s.dy += dy;
        stretch && stretch.call(s);
        if (!anim) {
          anim = elem.animate(function () {
            var dx = s.dx, dy = s.dy, mx = Math.abs(dx), my = Math.abs(dy);
            var more = restore.call(s, dx, dy, mx, my) || s.dx || s.dy || s.grip;
            if (!more) {
              anim = null;
              balance && balance.call(s);
            }
            return more;
          });
          perturb && perturb.call(s);
        }
      }
    })
  });

  Sky.SVGElem.prototype.update({
    dolly: Orb.type(function Dolly(elem, jack, opts) {
      var opts = up({}, opts);
      var bbox = opts.bbox || {}, vbox = opts.vbox || elem.node.getBBox();
      var xmin = def(bbox.x, -Infinity), xmax = def(bbox.x + bbox.width - vbox.width, Infinity);
      var ymin = def(bbox.y, -Infinity), ymax = def(bbox.y + bbox.height - vbox.height, Infinity);

      this.elem = elem.attrs({viewBox: [vbox.x, vbox.y, vbox.width, vbox.height]});
      this.jack = jack;
      this.move = function (dx, dy) {
        var cur = elem.node.viewBox.baseVal;
        var dim = [clip(cur.x - dx, xmin, xmax),
                   clip(cur.y - dy, ymin, ymax),
                   cur.width, cur.height];
        elem.attrs({viewBox: this.push(dx, dy, dim) || dim});
      }
    }),
    wagon: Orb.type(function Wagon(elem, jack, opts) {
      var opts = up({}, opts);
      var bbox = opts.bbox || {};
      var xmin = def(bbox.x, -Infinity), xmax = def(bbox.x + bbox.width, Infinity);
      var ymin = def(bbox.y, -Infinity), ymax = def(bbox.y + bbox.height, Infinity);

      this.elem = elem;
      this.jack = jack;
      this.move = function (dx, dy) {
        var cur = elem.transformation(), off = cur.translate || [0, 0];
        cur.translate = [clip(off[0] + dx, xmin, xmax),
                         clip(off[1] + dy, ymin, ymax)];
        elem.transform(this.push(dx, dy, cur) || cur);
      }
    })
  });

  Orb.prototype.update({
    guide: Orb.type(function Guide(orb, jack, opts) {
      var opts = up({}, opts);
      var elem = orb.elem;
      var bbox = elem.node.getBBox(), lane = opts.lane || {};
      var w = lane.width || bbox.width, h = lane.height || bbox.height;

      this.elem = elem;
      this.jack = elem.spring(cat(orb, jack), {
        kx: opts.kx,
        ky: opts.ky,
        balance: function () {
          var t = elem.transformation(), z = t.translate || [0, 0];
          var ox = ~~(z[0] % w), oy = ~~(z[1] % h);
          if (ox || oy)
            this.move(Math.abs(ox) < w / 2 ? -ox : sgn(ox) * w - ox,
                      Math.abs(oy) < h / 2 ? -oy : sgn(oy) * h - oy);
          else
            elem.trigger('settle', [~~(z[0] / w), ~~(z[1] / h)]);
        }
      });
    }),

    loop: Orb.type(function Loop(orb, jack, opts) {
      var opts = up({}, opts);
      var bbox = opts.bbox || {}, wrap = opts.wrap || function () {};
      var xmin = def(bbox.x, -Infinity), xmax = def(bbox.x + bbox.width, Infinity);
      var ymin = def(bbox.y, -Infinity), ymax = def(bbox.y + bbox.height, Infinity);
      var wide = xmax - xmin, high = ymax - ymin;
      var elem = orb.elem;

      this.elem = elem;
      this.jack = cat(orb, jack);
      this.move = function (dx, dy) {
        var t = this.push(dx, dy) || elem.transformation(), z = t.translate || [0, 0];
        var ox = z[0], oy = z[1], over = true;
        while (over) {
          over = false;
          if (wide) {
            if (ox < xmin)
              over = wrap.call(this, +1, 0, ox += wide, oy) || true;
            if (ox > xmax)
              over = wrap.call(this, -1, 0, ox -= wide, oy) || true;
          }
          if (high) {
            if (oy < ymin)
              over = wrap.call(this, 0, +1, ox, oy += high) || true;
            if (oy > ymax)
              over = wrap.call(this, 0, -1, ox, oy -= high) || true;
          }
        }
        t.translate = [ox, oy];
        elem.transform(t);
      }
    })
  });
})();
