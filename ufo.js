(function () {
  var P = Sky.path, U = Sky.util, up = Sun.up, Cage = Sun.Cage;

  up(Sky.SVGElem.prototype, {
    button: function (fun) {
      return this.g({cursor: 'pointer'}).tap(fun)
    },

    chevron: function (cx, cy, w, h) {
      return this.path(P.chevron(cx, cy, w, h)).attrs({fill: 'none', 'stroke-width': 1.5})
    }
  })

  var Nav = Sun.cls(function Nav(init, state, frame) {
    Cage.call(this)
    this.pages = init(this)
    this.state = state;
    this.frame = frame;
  }, new Cage, {
    action: function () {
      var self = this;
      var fn = this.bind.apply(this, arguments)
      return function () {
        var orb = fn.apply(self, arguments)
        Orb.grab(orb)
        Orb.move(orb, 100)
        Orb.free(orb)
        return orb;
      }
    },

    bind: function (key) {
      var fn = this[key]
      return fn.bind.apply(fn, [this].concat([].slice.call(arguments, 1)))
    },

    load: function (state, opts) {
      var state = up(state || this.state, {nav: this})
      var win = this.frame.window(state, opts)
      return this.pages[state.tag].draw(win) || win;
    },

    step: function (tag, data) {
      var state = {tag: tag, data: data, prev: this.state, parent: this.state.parent}
      return this.load(state, {transition: 'next'})
    },
    back: function (data) {
      var state = data ? up(this.state.prev, {data: data}) : this.state.prev;
      return this.load(state, {transition: 'prev'})
    },

    open: function (tag, data) {
      var state = {tag: tag, data: data, parent: this.state}
      return this.load(state, {transition: 'new'})
    },
    shut: function (data) {
      var state = data ? up(this.state.parent, {data: data}) : this.state.parent;
      return this.load(state, {transition: 'old'})
    }
  })

  var proto = {
    theme: function (base) {
      return this.walk(function (acc) { return up(acc, this.opts.theme) }, base || {})
    }
  }

  var otype = function (cons) {
    var args = [].slice.call(arguments, 1)
    return Orb.type.apply(Orb, [].concat.call([cons, proto], args))
  }

  var iOS7x = {
    frame: otype(function Frame(pkg, root, opts) {
      Cage.call(this)
      var opts = this.opts = up({}, opts)
      var dims = this.dims = Sky.box(0, 0, 200, 200 / opts.aspectRatio)
      var elem = this.elem = new Sky.svg({viewBox: dims}).addTo(root)
      this.on('top', function (n, o) { o && o != n && o.elem.remove() })
    }, new Cage, {
      window: otype(function Window(frame, state, opts) {
        var parent = this.parent = frame;
        var opts = this.opts = up({}, opts)
        var dims = this.dims = frame.dims;
        var elem = this.elem = frame.elem.g()
        var chrome = this.chrome = elem.g()
        var content = this.content = elem.g()

        var self = this;
        var xfer, percent;
        if (!frame.top)
          frame.change('top', this)
        this.state = up(state, {win: this})
        this.jack = elem.spring(elem.orb({
          move: function (dx) { xfer.call(this, percent = U.clip(percent + dx, 0, 100)) }
        }, this.plugs = []), {
          kx: 2,
          balance: function () {
            if (percent >= 50) {
              if (percent < 100)
                return this.move(100 - percent)
              state.nav.change('state', state)
              frame.change('top', self)
            } else {
              if (percent > 0)
                return this.move(-percent)
              elem.remove()
            }
          }
        })

        switch (opts.transition) {
        case 'next':
          xfer = function (p) {
            if (frame.top) {
              frame.top.chrome.style({opacity: (1 - p / 100)})
              Orb.move(frame.top.plugs, -p / 100)
            }
            chrome.style({opacity: p / 100})
            content.transform({translate: (1 - p / 100) * dims.w})
            this.push(1 - p / 100)
          }
          break;

        case 'prev':
          elem.insert(0)
          xfer = function (p) {
            if (frame.top) {
              frame.top.chrome.style({opacity: 1 - p / 100})
              frame.top.content.transform({translate: p / 100 * dims.w})
              Orb.move(frame.top.plugs, p / 100)
            }
            chrome.style({opacity: p / 100})
            this.push(p / 100 - 1)
          }
          break;

        case 'new':
          xfer = function (p) {
            elem.transform({translate: [0, (1 - p / 100) * dims.h]})
          }
          break;

        case 'old':
        default:
          elem.insert(0)
          xfer = function (p) {
            if (frame.top)
              frame.top.elem.transform({translate: [0, p / 100 * dims.h]})
          }
          break;
        }
        xfer.call(this, percent = 0)
      }, {
        navbar: otype(function NavBar(win, opts) {
          var x, y, w, h, d = win.dims;
          var parent = this.parent = win;
          var opts = this.opts = up({}, opts)
          var dims = this.dims = Sky.box(x = d.x, y = d.y, w = d.w, h = .07 * d.h)
          var elem = this.elem = win.chrome.g({'font-size': 10})

          var m = dims.midY;
          var state = win.state, nav = state.nav, page = nav.pages[state.tag], prev = state.prev;
          var title = opts.title || page.title, right = opts.right;
          var theme = this.theme({link: 'blue', tint: '#fdfdfd', line: '#101010'})

          var bgrd = this.bgrd = elem.rect(x, y, w, h).attrs({fill: theme.tint})
          var tbar = this.tbar = elem.label(dims.midX, m, title).attrs({'font-weight': 700})
          var line = this.line = elem.border(0, 0, .1, 0).attrs({fill: theme.line})

          if (prev) {
            var back = this.back = elem.button(function () { nav.action('back')(state.data) })
            back.chevron(x + 6, m, -5).attrs({stroke: theme.link})
            back.label(x + 12, m, nav.pages[prev.tag].title, -1).attrs({fill: theme.link})
          }
          if (right) {
            var rbtn = this.rbtn = elem.button(function () { right.action() })
            rbtn.label(dims.right - 6, m, right.label, 1).attrs({fill: theme.link})
          }

          win.plugs.push({
            move: function (px) {
              tbar.transform({translate: px < 0 ? px * (w / 2 - 12) : px * (w / 2 - 6)})
            }
          })
        })
      })
    }),
  }

  UFO = {
    Nav: Nav,
    iOS7x: iOS7x
  }
})();
