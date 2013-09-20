(function () {
  var anim = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame;
  var util = {
    clip: function (x, m, M) {
      return Math.min(Math.max(x, m), M);
    },
    mix: function (x, opts) {
      var o = util.update({min: 0, max: 100, lo: {b: 100}, hi: {r: 100}}, opts);
      var m = o.min, M = o.max, lo = o.lo, hi = o.hi;
      function w(a, b) { return ((b || 0) * Math.max(x - m, 0) + (a || 0) * Math.max(M - x, 0)) / (M - m) }
      function i(a, b) { return Math.round(w(a, b)) };
      if (lo.a == undefined && hi.a == undefined)
        return new RGB({r: i(lo.r, hi.r), g: i(lo.g, hi.g), b: i(lo.b, hi.b)});
      return new RGB({r: i(lo.r, hi.r), g: i(lo.g, hi.g), b: i(lo.b, hi.b), a: w(lo.a, hi.a)});
    },
    update: function (a, b) {
      for (var k in b)
        a[k] = b[k];
      return a;
    }
  };

  var trig = util.trig = {
    DtR: Math.PI / 180,
    rad: function (a) { return trig.DtR * a },
    sin: function (a) { return Math.sin(trig.rad(a)) },
    cos: function (a) { return Math.cos(trig.rad(a)) },
    cut: function (x) { return util.clip(x, -359.999, 359.999) }
  };

  var path = function (cmd) {
    return cmd + Array.prototype.slice.call(arguments, 1);
  };
  path = util.update(path, {
      M: function (xy) { return path('M', xy) },
      L: function (xy) { return path('L', xy) },
      join: function () {
        return Array.prototype.reduce.call(arguments, function (d, a) { return d + path.apply(null, a) }, '');
      },
      triangle: function (cx, cy, b, h, open) {
        var open = open || path.M;
        var h = h == undefined ? b : h;
        var x = cx - b / 2, y = cy - h / 2;
        return open([x, y]) + path('L', cx, y + h) + path('L', x + b, y) + 'Z';
      },
      box: function (cx, cy, w, h, open) {
        var open = open || path.M;
        var h = h == undefined ? w : h;
        var x = cx - w / 2, y = cy - h / 2;
        return open([x, y]) + path('H', x + w) + path('V', y + h) + path('H', x) + 'Z';
      },
      arc: function (cx, cy, rx, ry, len, off, open) {
        var open = open || path.M;
        var len = trig.cut(len == undefined ? 360 : len), off = off || 0;
        var ix = cx + rx * trig.cos(off), iy = cy + ry * trig.sin(off);
        var fx = cx + rx * trig.cos(off + len), fy = cy + ry * trig.sin(off + len);
        return (open([ix, iy]) +
                path('A',
                     rx, ry, 0,
                     Math.abs(len) > 180 ? 1 : 0,
                     len > 0 ? 1 : 0,
                     fx, fy));
      },
      oval: function (cx, cy, rx, ry, open) {
        var ry = ry == undefined ? rx : ry;
        return path.arc(cx, cy, rx, ry, 360, 0, open);
      },
      arch: function (cx, cy, rx, ry, t, len, off, open) {
        var len = trig.cut(len == undefined ? 360 : len), off = off || 0;
        var t = t == undefined ? 1 : t;
        return (path.arc(cx, cy, rx, ry, len, off, open) +
                path.arc(cx, cy, rx + t, ry + t, -len, off + len, path.L) + 'Z');
      },
      ring: function (cx, cy, rx, ry, t, open) {
        var t = t == undefined ? 1 : t;
        return (path.arc(cx, cy, rx, ry, 360, 0, open) +
                path.arc(cx, cy, rx + t, ry + t, -360, 360));
      }
    });

  function RGB(data) {
    Sky.util.update(this, data);
  }
  RGB.prototype.toString = function () {
    if ('a' in this)
      return 'rgba(' + (this.r || 0) + ',' + (this.g || 0) + ',' + (this.b || 0) + ',' + this.a + ')';
    return 'rgb(' + (this.r || 0) + ',' + (this.g || 0) + ',' + (this.b || 0) + ')';
  };

  function Elem(elem, attrs, props) {
    this.node = elem instanceof Node ? elem : document.createElementNS(this.xmlns, elem);
    this.attrs(attrs);
    this.props(props);
  }
  Elem.prototype.update = function (obj) { return util.update(this, obj) };
  Elem.prototype = Elem.prototype.update({
      xmlns: "http://www.w3.org/1999/xhtml",
      addTo: function (parent) {
        var p = parent instanceof Node ? parent : parent.node;
        p.appendChild(this.node);
        return this;
      },
      child: function (elem, attrs, props) {
        return new this.constructor(elem, attrs, props).addTo(this);
      },
      clear: function () {
        var node = this.node;
        while (node.firstChild)
          node.removeChild(node.firstChild);
        return this;
      },
      attrs: function (attrs, ns) {
        for (var k in attrs)
          this.node.setAttributeNS(ns || null, k, attrs[k]);
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
      animate: function (fun, n) {
        var self = this, i = 0;
        anim(function () {
            if (fun.call(self, self.node, i++) || i < n)
              anim(arguments.callee);
          });
        return this;
      },
      remove: function () {
        this.node.parentNode.removeChild(this.node);
        return this;
      },
      on: function (types, fun, capture) {
        var node = this.node;
        types.split(/\s+/).map(function (type) {
            node.addEventListener(type, fun, capture);
          });
        return this;
      },
      off: function (types, fun, capture) {
        var node = this.node;
        types.split(/\s+/).map(function (type) {
            node.removeEventListener(type, fun, capture);
          });
        return this;
      },
      trigger: function (type, data) {
        this.node.dispatchEvent(new CustomEvent(type, {detail: data}));
        return this;
      },
      upon: function (types, fun, capture) {
        var f = function (e) { return fun.call(this, e, e.detail) };
        return this.on(types, f, capture) && f;
      },
      doc: function () {
        return this.node instanceof Document ? this : new Elem(this.node.ownerDocument);
      },
      txt: function (text) {
        return this.props({textContent: text});
      }
    });

  function SVGElem() {
    Elem.apply(this, arguments);
  }
  SVGElem.prototype = new Elem().update({
      constructor: SVGElem,
      xmlns: "http://www.w3.org/2000/svg",
      xlink: "http://www.w3.org/1999/xlink",
      box: function (cx, cy, w, h) {
        return this.rect(cx - w / 2, cy - h / 2, w, h);
      },
      circle: function (cx, cy, r) {
        return this.child('circle', {cx: cx, cy: cy, r: r});
      },
      ellipse: function (cx, cy, rx, ry) {
        return this.child('ellipse', {cx: cx, cy: cy, rx: rx, ry: ry});
      },
      line: function (x1, y1, x2, y2) {
        return this.child('line', {x1: x1, y1: y1, x2: x2, y2: y2});
      },
      rect: function (x, y, w, h) {
        return this.child('rect', {x: x, y: y, width: w, height: h});
      },
      path: function (d) {
        return this.child('path', d && {d: d});
      },
      text: function (x, y, text) {
        return this.child('text', {x: x, y: y}, {textContent: text});
      },
      tspan: function (text) {
        return this.child('tspan', {}, {textContent: text});
      },
      polyline: function (points) {
        return this.child('polyline', {points: points});
      },
      polygon: function (points) {
        return this.child('polygon', {points: points});
      },
      g: function (attrs, props) {
        return this.child('g', attrs, props);
      },
      image: function (x, y, w, h, href, xattrs) {
        return this.child('image').attrs(util.update({href: href}, xattrs), this.xlink).attrs({x: x, y: y, width: w, height: h});
      },
      link: function (href, xattrs) {
        return this.child('a').attrs(util.update({href: href}, xattrs), this.xlink);
      },
      use: function (href, xattrs) {
        return this.child('use').attrs(util.update({href: href}, xattrs), this.xlink);
      },
      svg: function (x, y, w, h) {
        return this.child('svg', {x: x, y: y, width: w, height: h});
      },
      enc: function () {
        return this.node.tagName == 'svg' ? this : new SVGElem(this.node.ownerSVGElement);
      },
      fit: function () {
        var box = this.node.getBBox();
        return this.enc().attrs({viewBox: [box.x, box.y, box.width, box.height]});
      },
      point: function (x, y) {
        var p = this.enc().node.createSVGPoint();
        p.x = x;
        p.y = y;
        return p;
      },
      transform: function (desc) {
        var xform = [];
        for (var k in desc)
          xform.push(k + '(' + [].concat(desc[k]).join(',') + ')');
        return this.attrs({transform: xform.join(' ')});
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
    });

  Sky = {
    RGB: RGB,
    util: util,
    path: path,
    Elem: Elem,
    SVGElem: SVGElem,
    elem: function (elem, attrs, props) {
      return new Elem(elem, attrs, props);
    },
    svg: function (attrs, props) {
      return new SVGElem('svg', util.update({version: "1.1"}, attrs), props);
    }
  };
})();
