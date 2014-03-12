(function () {
  var def = Sky.util.def, clip = Sky.util.clip;
  var pop = Sky.util.pop, up = Sky.util.update;
  var abs = Math.abs, log = Math.log, E = Math.E, Inf = Infinity;
  var sgn = function (x) { return x < 0 ? -1 : 1 }
  var cat = function (a, b) { return b ? [].concat(a, b) : a }

  var touch = 'ontouchstart' in window;
  var pointerdown = touch ? 'touchstart' : 'mousedown';
  var pointermove = touch ? 'touchmove' : 'mousemove';
  var pointerup = touch ? 'touchend' : 'mouseup';

  Orb = function Orb(obj, jack, elem) {
    this.jack = jack || this.jack;
    this.elem = elem || this.elem;
    this.grip = 0;
    this.update(obj)
  }
  Orb.prototype.update = function (obj) { return up(this, obj) }
  Orb.prototype.update({
    prop: function (f, a) { return Orb.do(this.jack, f, a) },
    push: function () { return this.prop('move', arguments) },
    grab: function () { this.grip++; return this.prop('grab', arguments) },
    free: function () { this.grip--; return this.prop('free', arguments) },
    move: function () { return this.prop('move', arguments) },
    walk: function (f, a) { return Orb.walk(this, f, a) }
  })
  Orb = up(Orb, {
    do: function (o, f, a) {
      if (o) {
        if (o[f])
          return o[f].apply(o, a)
        if (o instanceof Array)
          return o.reduce(function (_, i) { return Orb.do(i, f, a) }, 0)
      }
    },
    call: function (o, f) { return Orb.do(o, f, [].slice.call(arguments, 2)) },
    grab: function (o) { return Orb.do(o, 'grab', [].slice.call(arguments, 1)) },
    free: function (o) { return Orb.do(o, 'free', [].slice.call(arguments, 1)) },
    move: function (o, dx, dy, a, r, g, s) {
      return Orb.do(o, 'move', [dx || 0, dy || 0, a, r, g, s])
    },
    init: function (o) { Orb.call(o); return o },
    type: function (cons) {
      var proto = cons.prototype = new Orb;
      [].slice.call(arguments, 1).map(function (base) { up(proto, base) })
      return function (a, r, g, s) { return Orb.init(new cons(this, a, r, g, s)) }
    },
    walk: function (o, f, a) {
      return f.call(o, o.parent ? Orb.walk(o.parent, f, a) : a)
    }
  })

  Sky.Elem.prototype.update({
    tap: function (fun, opts) {
      var opts = up({gap: 250, mx: 1, my: 1}, opts)
      var open, Dx = 0, Dy = 0;
      return this.swipe(this.orb({
        grab: function () {
          open = true;
          setTimeout(function () { open = false }, opts.gap)
        },
        move: function (dx, dy) {
          Dx += abs(dx)
          Dy += abs(dy)
          if (Dx > opts.mx || Dy > opts.my)
            open = false;
        },
        free: function () {
          if (open)
            fun && fun.apply(this, arguments)
          open = false;
        }
      }))
    },
    dbltap: function (fun, opts) {
      var opts = up({gap: 250}, opts)
      var self= this, taps = 0;
      this.on(pointerdown, function (e) {
        if (taps++)
          fun && fun.apply(self, arguments)
        setTimeout(function () { taps = 0 }, opts.gap)
        if (opts.prevent)
          e.preventDefault()
      })
      return this;
    },

    press: function (o, opts) {
      var opts = up({gain: 1, every: 1}, opts)
      var press, i;
      this.on(pointerdown, function (e) {
        if (!press)
          Orb.grab(o, e)
        press = true;
        i = setInterval(function () { Orb.move(o, opts.gain) }, opts.every)
        if (opts.prevent)
          e.preventDefault()
      })
      this.doc().on(pointerup, function (e) {
        if (press)
          Orb.free(o, e)
        press = false;
        clearInterval(i)
        if (opts.prevent)
          e.preventDefault()
      })
      return this;
    },
    swipe: function (o, opts) {
      var opts = up({glob: true}, opts)
      var swipe = 0, lx, ly;
      var doc = this.doc(), that = opts.glob ? doc : this;
      this.on(pointerdown, function (e) {
        var t = e.touches ? e.touches[0] : e;
        if (!swipe++)
          Orb.grab(o, e)
        lx = t.pageX;
        ly = t.pageY;
        if (opts.prevent)
          e.preventDefault()
      })
      that.on(pointermove, function (e) {
        if (swipe) {
          var t = e.touches ? e.touches[0] : e;
          Orb.move(o, t.pageX - lx, t.pageY - ly, lx, ly, t.pageX, t.pageY)
          lx = t.pageX;
          ly = t.pageY;
          if (opts.stop)
            e.stopImmediatePropagation()
          if (opts.prevent)
            e.preventDefault()
        }
      })
      doc.on(pointerup, function (e) {
        if (swipe && !--swipe)
          Orb.free(o, e)
        if (opts.prevent)
          e.preventDefault()
      })
      return this;
    },
    scroll: function (o, opts) {
      var opts = up({prevent: true}, opts)
      return this.on('mousewheel', function (e) {
        Orb.move(o, e.wheelDeltaX, e.wheelDeltaY)
        if (opts.stop)
          e.stopImmediatePropagation()
        if (opts.prevent)
          e.preventDefault()
      }).swipe(o, opts)
    },

    orb: function (obj, jack) {
      return new Orb(obj, jack, this)
    },

    crank: Orb.type(function Crank(elem, jack, opts) {
      var opts = up({}, opts)
      var cx = opts.cx || 0, cy = opts.cy || 0;
      var c = elem.point(cx, cy).matrixTransform(elem.node.getScreenCTM())

      this.elem = elem;
      this.jack = jack;
      this.move = function (dx, dy, px, py) {
        var rx = px - c.x, ry = py - c.y;
        if (rx > 0)
          dy = -dy;
        if (ry < 0)
          dx = -dx;
        return this.push(dx + dy, 0, this)
      }
    }),

    spring: Orb.type(function Spring(elem, jack, opts) {
      var opts = up({}, opts)
      var lock = opts.lock;
      var kx = opts.kx || 8, ky = opts.ky || 8;
      var lx = opts.lx || 1, ly = opts.ly || 1;
      var tx = opts.tx || 1, ty = opts.ty || 1;
      var restore = opts.restore || function (dx, dy, mx, my) {
        if (lock && this.grip)
          return;
        if (mx > tx) dx /= kx * log(mx + 1)
        if (my > ty) dy /= ky * log(my + 1)
        this.dx -= dx;
        this.dy -= dy;
        return this.push(dx, dy, this)
      }
      var stretch = opts.stretch, balance = opts.balance, perturb = opts.perturb;
      var anim;

      this.dx = 0;
      this.dy = 0;
      this.elem = elem;
      this.jack = jack;
      this.move = function (dx, dy) {
        var s = this;
        s.dx += lx * dx;
        s.dy += ly * dy;
        stretch && stretch.call(s)
        if (!anim) {
          perturb && perturb.call(s)
          anim = elem.animate(function () {
            var dx = s.dx, dy = s.dy, mx = abs(dx), my = abs(dy)
            var more = restore.call(s, dx, dy, mx, my) || s.dx || s.dy || s.grip;
            if (!more) {
              anim = null;
              balance && balance.call(s)
            }
            return more;
          })
        }
      }
    }),

    guide: Orb.type(function Guide(elem, jack, opts) {
      var self = this;
      var opts = up({}, opts)
      var lane = pop(opts, 'lane', {}), bbox = opts.bbox || elem.bbox()
      var w = lane.width || bbox.width, h = lane.height || bbox.height;
      var px = this.px = opts.px || 0, py = this.py || 0;
      var balance = opts.balance, truncate = pop(opts, 'truncate')
      var spring = elem.spring(jack, up(opts, {
        balance: function () {
          var ox = w && px % w, oy = h && py % h;
          if (abs(ox) > 1e-3 || abs(oy) > 1e-3)
            Orb.move(self.hook || self,
                     abs(ox) < w / 2 && !truncate ? -ox : sgn(ox) * w - ox,
                     abs(oy) < h / 2 && !truncate ? -oy : sgn(oy) * h - oy)
          else
            elem.trigger('settle', [~~(px / w), ~~(py / h)])
          balance && balance.call(this)
        }
      }))

      this.elem = elem;
      this.jack = spring;
      this.move = function (dx, dy) {
        self.px = px += dx;
        self.py = py += dy;
        self.push(dx, dy)
      }
      this.goto = function (i, j) {
        var ox = px + spring.dx - (i || 0) * w, oy = py + spring.dy - (j || 0) * h;
        self.move(-ox, -oy)
      }

      this.slot = function () {
        return [~~((px + spring.dx) / w), ~~((py + spring.dy) / h)]
      }
    }),

    tether: Orb.type(function Tether(elem, jack, opts) {
      var self = this;
      var opts = up({}, opts)
      var rx = opts.rx || 1, ry = opts.ry || 1;
      var px = this.px = opts.px || 0, py = this.py = opts.py || 0;
      var xmin, xmax, ymin, ymax;
      this.setBBox = function (bbox) {
        var b = self.bbox = bbox || {}
        xmin = def(b.x, -Inf); xmax = def(b.x + b.width, Inf)
        ymin = def(b.y, -Inf); ymax = def(b.y + b.height, Inf)
        if (px < xmin || px > xmax || py < ymin || py > ymax)
          self.goto(px < xmin ? xmin : (py > xmax ? xmax : px),
                    py < ymin ? ymin : (py > ymax ? ymax : py))
      }
      var plug = elem.orb({
        move: function (dx, dy) {
          self.px = px += dx;
          self.py = py += dy;
          return this.push(dx, dy)
        }
      }, jack)
      var coil = elem.spring(plug, {kx: 1, ky: 1, lx: -1, ly: -1, lock: true})
      this.elem = elem;
      this.jack = cat(plug, coil)
      this.move = function (dx, dy) {
        var cx = 0, cy = 0, ix = dx, iy = dy;
        var nx = px + dx + coil.dx, ny = py + dy + coil.dy;
        var ux = nx - xmin, uy = ny - ymin;
        var ox = nx - xmax, oy = ny - ymax;
        if (ux < 0 && dx < 0) {
          cx = (px < xmin ? dx : ux) / (rx * log(abs(coil.dx) + E))
          ix = Math.min(dx - ux, 0)
        } else if (ox > 0 && dx > 0) {
          cx = (px > xmax ? dx : ox) / (rx * log(abs(coil.dx) + E))
          ix = Math.max(dx - ox, 0)
        }
        if (uy < 0 && dy < 0) {
          cy = (py < ymin ? dy : uy) / (ry * log(abs(coil.dy) + E))
          iy = Math.min(dy - uy, 0)
        } else if (oy > 0 && dy > 0) {
          cy = (py > ymax ? dy : oy) / (ry * log(abs(coil.dy) + E))
          iy = Math.max(dy - oy, 0)
        }
        Orb.move(coil, cx, cy)
        return Orb.move(plug, cx + ix, cy + iy)
      }

      this.goto = function (x, y) {
        return Orb.move(this, (x || 0) - (px + coil.dx), (y || 0) - (py + coil.dy))
      }

      this.setBBox(opts.bbox || elem.bbox())
    })
  })

  Sky.SVGElem.prototype.update({
    dolly: Orb.type(function Dolly(elem, jack, opts) {
      var opts = up({}, opts)
      var vbox = opts.vbox || elem.bbox()
      var xmin, xmax, ymin, ymax;
      var setBBox = this.setBBox = function (bbox) {
        var b = bbox || {}
        xmin = def(b.x, -Inf); xmax = def(b.x + b.width - vbox.width, Inf)
        ymin = def(b.y, -Inf); ymax = def(b.y + b.height - vbox.height, Inf)
      }
      setBBox(opts.bbox)

      this.elem = elem.attrs({viewBox: [vbox.x, vbox.y, vbox.width, vbox.height]})
      this.jack = jack;
      this.move = function (dx, dy) {
        var cur = elem.node.viewBox.baseVal;
        var dim = [clip(cur.x - dx, xmin, xmax),
                   clip(cur.y - dy, ymin, ymax),
                   cur.width, cur.height]
        elem.attrs({viewBox: this.push(dx, dy, dim) || dim})
      }
    }),
    wagon: Orb.type(function Wagon(elem, jack, opts) {
      var opts = up({}, opts)
      var xmin, xmax, ymin, ymax;
      var setBBox = this.setBBox = function (bbox) {
        var b = bbox || {}
        xmin = def(b.x, -Inf); xmax = def(b.x + b.width, Inf)
        ymin = def(b.y, -Inf); ymax = def(b.y + b.height, Inf)
      }
      setBBox(opts.bbox)

      this.elem = elem;
      this.jack = jack;
      this.move = function (dx, dy) {
        var cur = elem.transformation(), off = cur.translate || [0, 0]
        cur.translate = [clip(off[0] + dx, xmin, xmax),
                         clip(off[1] + dy, ymin, ymax)]
        elem.transform(this.push(dx, dy, cur) || cur)
      }
    }),

    loop: Orb.type(function Loop(elem, jack, opts) {
      var opts = up({}, opts)
      var bbox = opts.bbox || {}, wrap = opts.wrap || function () {}
      var xmin = def(bbox.x, -Inf), xmax = def(bbox.x + bbox.width, Inf)
      var ymin = def(bbox.y, -Inf), ymax = def(bbox.y + bbox.height, Inf)
      var wide = xmax - xmin, high = ymax - ymin;

      this.elem = elem;
      this.jack = jack;
      this.move = function (dx, dy, cur) {
        var off = cur.translate || [0, 0]
        var ox = off[0], oy = off[1], lx = ox, ly = oy, over = true;
        while (over) {
          over = false;
          if (wide) {
            var wx = lx < xmin && 1 || lx > xmax && -1;
            if (wx) {
              over = true;
              lx += wx * wide;
              if (!wrap.call(this, wx, 0, ox, oy))
                ox += wx * wide;
            }
          }
          if (high) {
            var wy = ly < ymin && 1 || ly > ymax && -1;
            if (wy) {
              over = true;
              ly += wy * high;
              if (!wrap.call(this, 0, wy, ox, oy))
                oy += wy * high;
            }
          }
        }
        cur.translate = [ox, oy]
        return this.push(dx, dy, cur) || cur;
      }
    })
  })
})();
