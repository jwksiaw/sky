(function () {
  var min = Math.min, max = Math.max;
  var def = function (x, d) { return isNaN(x) ? d : x }
  var get = function (a, k, d) { var v = a[k]; return v == undefined ? d : v }
  var pop = function (a, k, d) { var v = get(a, k, d); delete a[k]; return v }
  var pre = function (a, k, d) { return a[k] = get(a, k, d) }
  var up = function (a, b) {
    for (var k in b)
      a[k] = b[k]
    return a;
  }
  var anim = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame;
  var util = {
    def: def,
    get: get,
    pop: pop,
    pre: pre,
    update: up,
    copy: function (b) { return up({}, b) },
    clip: function (x, m, M) { return min(max(x, m), M) },
    randInt: function (m, M) { return Math.round((M - m) * Math.random()) + m }
  }

  var trig = util.trig = {
    rad: function (a) { return Math.PI / 180 * a },
    sin: function (a) { return Math.sin(trig.rad(a)) },
    cos: function (a) { return Math.cos(trig.rad(a)) },
    cut: function (x) { return util.clip(x, -359.999, 359.999) }
  }

  var path = function (cmd) { return cmd + [].slice.call(arguments, 1) }
  var P = up(path, {
    M: function (xy) { return P('M', xy) },
    L: function (xy) { return P('L', xy) },
    join: function () {
      return [].reduce.call(arguments, function (d, a) { return d + P.apply(null, a) }, '')
    },
    line: function (x1, y1, x2, y2, open) {
      var open = open || P.M;
      return open([x1, y1]) + P.L([x2, y2])
    },
    rect: function (x, y, w, h, open) {
      var open = open || P.M;
      var h = def(h, w)
      return open([x, y]) + P('H', x + w) + P('V', y + h) + P('H', x) + 'Z';
    },
    border: function (box, t, r, b, l, open) {
      var t = def(t, 0), r = def(r, t), b = def(b, t), l = def(l, r)
      with (box) {
        var ix = x + l, iy = y + t, iw = w - l - r, ih = h - t - b;
        return (P.line(x, y, x + w, y, open) + P('v', h) + P('h', -w) + P('v', -h) +
                P.line(ix, iy, ix, iy + ih) + P('h', iw) + P('v', -ih) + P('h', -iw))
      }
    },
    chevron: function (cx, cy, w, h, open) {
      var open = open || P.M;
      var h = def(h, 2 * w), g = h / 2;
      var x = cx - w / 2, y = cy - g;
      return open([x, y]) + P('l', w, g) + P('l', -w, g)
    },
    triangle: function (cx, cy, b, h, open) {
      var open = open || P.M;
      var h = def(h, b)
      var x = cx - b / 2, y = cy - h / 2;
      return open([x, y]) + P('L', cx, y + h) + P('L', x + b, y) + 'Z';
    },
    arc: function (cx, cy, rx, ry, len, off, open) {
      var open = open || P.M;
      var len = trig.cut(def(len, 360)), off = off || 0;
      var ix = cx + rx * trig.cos(off), iy = cy + ry * trig.sin(off)
      var fx = cx + rx * trig.cos(off + len), fy = cy + ry * trig.sin(off + len)
      return (open([ix, iy]) +
              P('A',
                   rx, ry, 0,
                   Math.abs(len) > 180 ? 1 : 0,
                   len > 0 ? 1 : 0,
                   fx, fy))
    },
    oval: function (cx, cy, rx, ry, open) {
      var ry = def(ry, rx)
      return P.arc(cx, cy, rx, ry, 360, 0, open)
    },
    arch: function (cx, cy, rx, ry, t, len, off, open) {
      var len = trig.cut(def(len, 360)), off = off || 0;
      var t = def(t, 1)
      return (P.arc(cx, cy, rx, ry, len, off, open) +
              P.arc(cx, cy, rx + t, ry + t, -len, off + len, P.L) + 'Z')
    },
    ring: function (cx, cy, rx, ry, t, open) {
      var t = def(t, 1)
      return (P.arc(cx, cy, rx, ry, 360, 0, open) +
              P.arc(cx, cy, rx + t, ry + t, -360, 360))
    }
  })

  function Box(d) {
    this.x = d.x || 0;
    this.y = d.y || 0;
    this.w = d.w || d.width || 0;
    this.h = d.h || d.height || 0;
  }
  Box.prototype = {
    constructor: Box,
    get width() { return this.w },
    get height() { return this.h },
    get left() { return this.x },
    get top() { return this.y },
    get midX() { return this.x + this.w / 2 },
    get midY() { return this.y + this.h / 2 },
    get right() { return this.x + this.w },
    get bottom() { return this.y + this.h },
    grid: function (fun, acc, opts) {
      var o = up({rows: 1, cols: 1}, opts)
      var r = o.rows, c = o.cols;
      var x = this.x, y = this.y, w = this.w / c, h = this.h / r;
      var z = new Box({x: x, y: y, w: w, h: h})
      for (var i = 0, n = 0; i < r; i++)
        for (var j = 0; j < c; j++, n++)
          acc = fun.call(this, acc, z.shift(w * j, h * i), i, j, n, z)
      return acc;
    },
    join: function (boxs) {
      var boxs = [].concat(boxs)
      var bnds = boxs.reduce(function (a, b) {
        return {x: min(a.x, b.x), y: min(a.y, b.y), right: max(a.right, b.right), bottom: max(a.bottom, b.bottom)}
      }, this)
      return new Box({x: bnds.x, y: bnds.y, w: bnds.right - bnds.x, h: bnds.bottom - bnds.y})
    },
    stack: function (fun, acc, opts) {
      var o = up({rows: 1, cols: 1}, opts)
      return this.copy({w: o.cols * this.w, h: o.rows * this.h}).grid(fun, acc, o)
    },
    split: function (opts) {
      return this.grid(function (acc, box) { return acc.push(box), acc }, [], opts)
    },
    align: function (box, ax, ay) {
      var nx = (ax || 0) / 2, ny = (ay || 0) / 2, ox = nx + .5, oy = ny + .5;
      var x = box.midX + nx * box.w - ox * this.w;
      var y = box.midY + ny * box.h - oy * this.h;
      return new Box({x: x, y: y, w: this.w, h: this.h})
    },
    center: function (cx, cy) {
      return new Box({x: cx - this.w / 2, y: cy - this.h / 2, w: this.w, h: this.h})
    },
    scale: function (a, b) {
      var w = a * this.w, h = def(b, a) * this.h;
      return new Box({x: this.midX - w / 2, y: this.midY - h / 2, w: w, h: h})
    },
    shift: function (dx, dy) {
      return new Box({x: this.x + (dx || 0), y: this.y + (dy || 0), w: this.w, h: this.h})
    },
    square: function (big) {
      var o = big ? max : min, d = o(this.w, this.h)
      return new Box({x: this.x, y: this.y, w: d, h: d})
    },
    slice: function (ps, hzn) {
      var d = hzn ? this.w : this.h, ps = [].concat(ps)
      var f = 1 - ps.reduce(function (s, p) { return isFinite(p) ? s + p : s }, 0) / d;
      return this.part(ps.map(function (p) {
        var pct = typeof(p) == 'string' && p[p.length - 1] == '%';
        return pct ? f * parseFloat(p.slice(0, -1)) / 100 : p / d;
      }), hzn)
    },
    part: function (ps, hzn) {
      var b = this, ko = hzn ? 'x' : 'y', kd = hzn ? 'w' : 'h';
      var o = b[ko], u = {}, s = 0, ps = [].concat(ps, undefined)
      return ps.map(function (p) {
        u[ko] = (o += u[kd] || 0)
        u[kd] = def(p, 1 - s) * b[kd]
        s += p;
        return b.copy(u)
      })
    },
    pad: function (t, r, b, l) {
      return this.trim(-t, -r, -b, -l)
    },
    trim: function (t, r, b, l) {
      var t = def(t, 0), r = def(r, t), b = def(b, t), l = def(l, r)
      return new Box({x: this.x + l, y: this.y + t, w: this.w - r - l, h: this.h - t - b})
    },
    copy: function (o) {
      var o = o || {}, ow = def(o.w, o.width), oh = def(o.h, o.height)
      with (this)
        return new Box({x: def(o.x, x), y: def(o.y, y), w: def(ow, w), h: def(oh, h)})
    },
    toString: function () { with (this) return x + ',' + y + ',' + w + ',' + h }
  }

  function RGB(d) { up(this, d) }
  RGB.mix = function (x, opts) {
    var o = up({min: 0, max: 100, lo: {b: 100}, hi: {r: 100}}, opts)
    var m = o.min, M = o.max, lo = o.lo, hi = o.hi;
    function w(a, b) { return ((b || 0) * Math.max(x - m, 0) + (a || 0) * Math.max(M - x, 0)) / (M - m) }
    function i(a, b) { return Math.round(w(a, b)) }
    if (lo.a == undefined && hi.a == undefined)
      return new RGB({r: i(lo.r, hi.r), g: i(lo.g, hi.g), b: i(lo.b, hi.b)})
    return new RGB({r: i(lo.r, hi.r), g: i(lo.g, hi.g), b: i(lo.b, hi.b), a: w(lo.a, hi.a)})
  }
  RGB.random = function () {
    return new RGB({r: util.randInt(0, 255), g: util.randInt(0, 255), b: util.randInt(0, 255)})
  }
  RGB.prototype.toString = function () {
    if (this.a == undefined)
      return 'rgb(' + (this.r || 0) + ',' + (this.g || 0) + ',' + (this.b || 0) + ')';
    return 'rgba(' + (this.r || 0) + ',' + (this.g || 0) + ',' + (this.b || 0) + ',' + this.a + ')';
  }

  function Elem(elem, attrs, props, doc) {
    this.node = elem && elem.nodeType ? elem : (doc || document).createElementNS(this.xmlns, elem)
    this.attrs(attrs)
    this.props(props)
  }
  Elem.prototype.update = function (obj) { return up(this, obj) }
  Elem.prototype.update({
    xml: "http://www.w3.org/XML/1998/namespace",
    xmlns: "http://www.w3.org/1999/xhtml",
    addTo: function (parent) {
      return (parent.node || parent).appendChild(this.node), this;
    },
    append: function (child) {
      return child.addTo(this) && this;
    },
    child: function (elem, attrs, props) {
      return new this.constructor(elem, attrs, props).addTo(this)
    },
    clear: function () {
      var node = this.node;
      while (node.firstChild)
        node.removeChild(node.firstChild)
      return this;
    },
    attr: function (name, ns) {
      return this.node.getAttributeNS(ns || null, name)
    },
    attrs: function (attrs, ns) {
      for (var k in attrs) {
        var v = attrs[k]
        if (v == null)
          this.node.removeAttributeNS(ns || null, k)
        else
          this.node.setAttributeNS(ns || null, k, v)
      }
      return this;
    },
    props: function (props) {
      for (var k in props)
        this.node[k] = props[k];
      return this;
    },
    style: function (attrs) {
      for (var k in attrs)
        this.node.style[k] = attrs[k];
      return this;
    },
    space: function (space) {
      return this.attrs({space: space}, this.xml)
    },
    animate: function (fun, n) {
      var self = this, i = 0;
      anim(function () {
        if (fun.call(self, self.node, i++) || i < n)
          anim(arguments.callee)
      })
      return this;
    },
    remove: function () {
      this.node.parentNode.removeChild(this.node)
      return this;
    },
    insert: function (k) {
      var n = this.node, p = n.parentNode;
      p.insertBefore(n, p.childNodes[k])
      return this;
    },
    on: function (types, fun, capture) {
      var node = this.node;
      types.split(/\s+/).map(function (type) {
        node.addEventListener(type, fun, capture)
      })
      return this;
    },
    off: function (types, fun, capture) {
      var node = this.node;
      types.split(/\s+/).map(function (type) {
        node.removeEventListener(type, fun, capture)
      })
      return this;
    },
    trigger: function (type, data, opts) {
      this.node.dispatchEvent(new CustomEvent(type, up({detail: data}, opts)))
      return this;
    },
    upon: function (types, fun, capture) {
      var f = function (e) { return fun.call(this, e, e.detail) }
      return this.on(types, f, capture) && f;
    },
    once: function (types, fun) {
      var n = 0;
      return this.til(types, fun, function () { return n++ })
    },
    til: function (types, fun, dead) {
      var self = this;
      self.on(types, function () {
        if (dead())
          self.off(types, arguments.callee)
        else
          fun.apply(this, arguments)
      })
    },
    bind: function (name) {
      var fun = this[name]
      return fun.bind.apply(fun, [this].concat([].slice.call(arguments, 1)))
    },
    each: function (sel, fun, acc) {
      return [].reduce.call(this.node.querySelectorAll(sel), fun, acc) || this;
    },
    root: function () {
      for (var n = this.node; n.parentNode; n = n.parentNode) {}
      return n;
    },
    doc: function () {
      return this.node.ownerDocument ? new Elem(this.node.ownerDocument) : this;
    },
    attached: function (o) {
      return this.root() == (o ? o.root() : this.doc().node)
    },
    detached: function (o) {
      return !this.attached(o)
    },
    txt: function (text) {
      return this.props({textContent: text})
    },
    $: function (q) {
      var node = typeof(q) == 'string' ? this.node.querySelector(q) : q;
      if (node)
        switch (node.namespaceURI) {
        case SVGElem.prototype.xmlns: return new SVGElem(node)
        case Elem.prototype.xmlns:
        default: return new Elem(node)
        }
    }
  })

  function SVGElem() {
    Elem.apply(this, arguments)
  }
  SVGElem.prototype = new Elem().update({
    constructor: SVGElem,
    xmlns: "http://www.w3.org/2000/svg",
    xlink: "http://www.w3.org/1999/xlink",
    circle: function (cx, cy, r) {
      return this.child('circle', {cx: cx, cy: cy, r: r})
    },
    ellipse: function (cx, cy, rx, ry) {
      return this.child('ellipse', {cx: cx, cy: cy, rx: rx, ry: ry})
    },
    line: function (x1, y1, x2, y2) {
      return this.child('line', {x1: x1, y1: y1, x2: x2, y2: y2})
    },
    rect: function (x, y, w, h) {
      return this.child('rect', {x: x, y: y, width: w, height: h})
    },
    path: function (d) {
      return this.child('path', d && {d: d})
    },
    text: function (x, y, text) {
      return this.child('text', {x: x, y: y}, {textContent: text})
    },
    tspan: function (text) {
      return this.child('tspan', {}, {textContent: text})
    },
    polyline: function (points) {
      return this.child('polyline', {points: points})
    },
    polygon: function (points) {
      return this.child('polygon', {points: points})
    },
    g: function (attrs, props) {
      return this.child('g', attrs, props)
    },
    image: function (x, y, w, h, href) {
      return this.child('image').href(href).xywh(x, y, w, h)
    },
    link: function (href) {
      return this.child('a').href(href)
    },
    use: function (href) {
      return this.child('use').href(href)
    },
    svg: function (attrs, props) {
      return this.child('svg', attrs, props)
    },
    icon: function (x, y, w, h, name) {
      return this.use(name).xywh(x, y, w, h)
    },
    label: function (x, y, text, i, j) {
      return this.text(x, y, text).anchor(i, j)
    },

    border: function (t, r, b, l, box) {
      return this.path(P.border(box || this.bbox(), t, r, b, l))
    },
    circleX: function (box, p, big) {
      var o = big ? max : min;
      with (box || this.bbox())
        return this.circle(box.midX, box.midY, def(p, 1) * o(w, h) / 2)
    },
    ellipseX: function (box, px, py) {
      with (box || this.bbox())
        return this.ellipse(midX, midY, def(px, 1) * w / 2, def(py, 1) * h / 2)
    },
    imageX: function (box, href) {
      with (box || this.bbox())
        return this.image(x, y, w, h, href)
    },
    iconX: function (box, name) {
      with (box || this.bbox())
        return this.icon(x, y, w, h, name)
    },
    rectX: function (box) {
      with (box || this.bbox())
        return this.rect(x, y, w, h)
    },
    textX: function (box, text, cx, cy) {
      with (box || this.bbox())
        return this.text(midX + (cx || 0) * w / 2, midY + (cy || 0) * h / 2, text).anchor(cx, cy)
    },

    anchor: function (i, j) {
      var a = i < 0 ? 'start' : (i > 0 ? 'end' : 'middle')
      var b = j < 0 ? 'hanging' : (j > 0 ? 'alphabetic' : 'central')
      return this.attrs({'text-anchor': a, 'dominant-baseline': b})
    },
    bbox: function () {
      return new Box(this.node.getBBox())
    },
    enc: function () {
      return this.node.tagName == 'svg' ? this : new SVGElem(this.node.ownerSVGElement)
    },
    fit: function () {
      return this.enc().attrs({viewBox: this.bbox()})
    },
    href: function (href) {
      return this.attrs({href: href}, this.xlink)
    },
    xywh: function (x, y, w, h) {
      return this.attrs({x: x, y: y, width: w, height: h})
    },
    point: function (x, y) {
      var p = this.enc().node.createSVGPoint()
      p.x = x;
      p.y = y;
      return p;
    },
    polar: function (r, a) {
      return [r * trig.cos(a), r * trig.sin(a)];
    },

    shift: function (dx, dy) {
      var x = this.transformation(), t = x.translate = x.translate || [0, 0]
      t[0] += dx || 0;
      t[1] += dy || 0;
      return this.transform(x)
    },
    transform: function (desc) {
      var xform = [];
      for (var k in desc)
        xform.push(k + '(' + [].concat(desc[k]).join(',') + ')')
      return this.attrs({transform: xform.join(' ')})
    },
    transformation: function (list) {
      var tx = {}, list = list || this.node.transform.baseVal;
      for (var i = 0; i < list.numberOfItems; i++) {
        var t = list.getItem(i), m = t.matrix;
        if (t.type == SVGTransform.SVG_TRANSFORM_MATRIX)
          tx.matrix = [m.a, m.b, m.c, m.d, m.e, m.f];
        else if (t.type == SVGTransform.SVG_TRANSFORM_TRANSLATE)
          tx.translate = [m.e, m.f];
        else if (t.type == SVGTransform.SVG_TRANSFORM_SCALE)
          tx.scale = [m.a, m.d];
        else if (t.type == SVGTransform.SVG_TRANSFORM_ROTATE)
          tx.rotate = [t.angle, (m.f / m.c + m.e) / m.a, (m.e / m.b - m.f) / m.a];
        else if (t.type == SVGTransform.SVG_TRANSFORM_SKEWX)
          tx.skewX = t.angle;
        else if (t.type == SVGTransform.SVG_TRANSFORM_SKEWY)
          tx.skewY = t.angle;
      }
      return tx;
    }
  })

  Sky = {
    util: util,
    path: path,
    box: function (x, y, w, h) { return new Box({x: x, y: y, w: w, h: h}) },
    rgb: function (r, g, b, a) { return new RGB({r: r, g: g, b: b, a: a}) },
    elem: function (elem, attrs, props, doc) { return new Elem(elem, attrs, props, doc) },
    svg: function (attrs, props, doc) { return new SVGElem('svg', attrs, props, doc) },
    $: function (q) { return new Elem(document).$(q) },
    Box: Box,
    RGB: RGB,
    Elem: Elem,
    SVGElem: SVGElem
  }
})();
