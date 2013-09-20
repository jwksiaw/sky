(function () {
  var clip = Sky.util.clip, update = Sky.util.update;
  var elem = Sky.Elem.prototype.update({
      dbltap: function (fun, opts) {
        var opts = update({gap: 250}, opts);
        var taps = 0;
        this.on('mouseup touchend', function () {
            if (taps++)
              fun();
            setTimeout(function () { taps = 0 }, opts.gap);
          });
        return this;
      },

      press: function (o, opts) {
        var opts = update({gain: 1, every: 1}, opts);
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
        var opts = update({glob: true}, opts);
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
        var opts = update({}, opts);
        var stop = opts.stop;
        return this.on('mousewheel', function (e) {
            Orb.grab(o);
            Orb.move(o, e.wheelDeltaX, e.wheelDeltaY);
            Orb.free(o);
            if (stop)
              e.stopImmediatePropagation();
            e.preventDefault();
          }).swipe(o, opts);
      },

      spring: function (o, opts) {
        var opts = update({}, opts);
        var kx = opts.kx || 32, ky = opts.ky || 32;
        var restore = opts.restore || function (dx, dy, mx, my) {
          if (mx > 1) dx /= kx;
          if (my > 1) dy /= ky;
          this.dx -= dx;
          this.dy -= dy;
          return this.push(dx, dy, this);
        };
        var elem = this, anim;
        var s = this.orb({
            dx: 0,
            dy: 0,
            move: function (dx, dy) {
              s.dx += dx;
              s.dy += dy;
              if (!anim) {
                anim = elem.animate(function () {
                    var dx = s.dx, dy = s.dy, mx = Math.abs(dx), my = Math.abs(dy);
                    var more = restore.call(s, dx, dy, mx, my) || s.dx || s.dy || s.grip;
                    if (!more) {
                      anim = null;
                      opts.balance && opts.balance.call(s);
                    }
                    return more;
                  });
                opts.stretch && opts.stretch.call(s);
              }
            }
          }, o);
        return s;
      },
      orb: function (obj, jack) {
        return new Orb(obj, jack, this);
      }
    });

  var svg = Sky.SVGElem.prototype.update({
      dolly: function (o, opts) {
        var opts = update({}, opts);
        var bbox = opts.bbox, vbox = opts.vbox || this.node.getBBox();
        var xmin = bbox ? bbox.x : -Infinity;
        var xmax = bbox ? bbox.x + bbox.width - vbox.width : Infinity;
        var ymin = bbox ? bbox.y : -Infinity;
        var ymax = bbox ? bbox.y + bbox.height - vbox.height : Infinity;
        var elem = this.attrs({viewBox: [vbox.x, vbox.y, vbox.width, vbox.height]});
        return this.orb({
            move: function (dx, dy) {
              var cur = elem.node.viewBox.baseVal;
              var dim = [clip(cur.x - dx, xmin, xmax),
                         clip(cur.y - dy, ymin, ymax),
                         cur.width, cur.height];
              elem.attrs({viewBox: this.push(dx, dy, dim) || dim});
            }
        }, o);
      },
      wagon: function (o, opts) {
        var opts = update({}, opts);
        var bbox = opts.bbox;
        var xmin = bbox ? bbox.x : -Infinity;
        var xmax = bbox ? bbox.x + bbox.width : Infinity;
        var ymin = bbox ? bbox.y : -Infinity;
        var ymax = bbox ? bbox.y + bbox.height : Infinity;
        var elem = this;
        return this.orb({
            move: function (dx, dy) {
              var cur = elem.transformation(), off = cur.translate || [0, 0];
              cur.translate = [clip(off[0] + dx, xmin, xmax),
                               clip(off[1] + dy, ymin, ymax)];
              elem.transform(this.push(dx, dy, cur) || cur);
            }
          }, o);
      },

      maglev: function (o, opts) {
        var opts = update({kx: 16, ky: 16}, opts);
        var cbox = this.node.getBBox(), gbox = opts.gbox || {};
        var elem = this, w = gbox.width || cbox.width, h = gbox.height || cbox.height;
        return this.spring(this.wagon(o, opts), {
            kx: opts.kx,
            ky: opts.ky,
            balance: function () {
              var t = elem.transformation(), z = t.translate;
              var ox = ~~(z[0] % w), oy = ~~(z[1] % h);
              var sx = ox < 0 ? -1 : 1, sy = oy < 0 ? -1 : 1;
              if (ox || oy)
                this.move(Math.abs(ox) < w / 2 ? -ox : sx * w - ox,
                          Math.abs(oy) < h / 2 ? -oy : sy * h - oy);
              else
                elem.trigger('nestle', [~~(z[0] / w), ~~(z[1] / h)]);
            }
          });
      }
    });

  function Orb(obj, jack, elem) {
    this.update(obj);
    this.jack = jack;
    this.elem = elem;
    this.grip = 0;
  };
  Orb.prototype.update = function (obj) { return update(this, obj) };
  Orb.prototype = Orb.prototype.update({
      prop: function (f, a) { return Orb.do(this.jack, f, a) },
      push: function () { return this.prop('move', arguments) },
      grab: function () { this.grip++; return this.prop('grab') },
      free: function () { this.grip--; return this.prop('free') },
    });
  Orb = update(Orb, {
      do: function (o, f, a) { return o && o[f] && o[f].apply(o, a) },
      grab: function (o) { return o.grab && o.grab() },
      free: function (o) { return o.free && o.free() },
      move: function (o, dx, dy, a, r, g, s) {
        return o.move && o.move(dx || 0, dy || 0, a, r, g, s);
      }
    });
})();