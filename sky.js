(function () {
  var anim = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame;
  var util = {
    mix: function (x, opts) {
      var o = util.update({min: 0, max: 100, lo: {b: 100, a: 1}, hi: {r: 100, a: 1}}, opts);
      var m = o.min, M = o.max, lo = o.lo, hi = o.hi;
      function w(a, b) { return ((b || 0) * Math.max(x - m, 0) + (a || 0) * Math.max(M - x, 0)) / (M - m) }
      function i(a, b) { return Math.round(w(a, b)) };
      return new RGB({r: i(lo.r, hi.r), g: i(lo.g, hi.g), b: i(lo.b, hi.b), a: w(lo.a, hi.a)});
    },
    update: function (a, b) {
      for (var k in b)
        a[k] = b[k];
      return a;
    }
  };

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
        parent.appendChild(this.node);
        return this;
      },
      child: function (elem, attrs, props) {
        return new this.constructor(elem, attrs, props).addTo(this.node);
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
      animate: function (fun) {
        var self = this, i = 0;
        anim(function () {
            if (fun.call(self, self.node, i++))
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
      }
    });

  function SVGElem() {
    Elem.apply(this, arguments);
  }
  SVGElem.prototype = new Elem().update({
      constructor: SVGElem,
      xmlns: "http://www.w3.org/2000/svg",
      xlink: "http://www.w3.org/1999/xlink",
      ellipse: function (cx, cy, rx, ry) {
        return this.child('ellipse', {cx: cx, cy: cy, rx: rx, ry: ry});
      },
      circle: function (cx, cy, r) {
        return this.child('circle', {cx: cx, cy: cy, r: r});
      },
      line: function (x1, y1, x2, y2) {
        return this.child('line', {x1: x1, y1: y1, x2: x2, y2: y2});
      },
      rect: function (x, y, w, h) {
        return this.child('rect', {x: x, y: y, width: w, height: h});
      },
      path: function (d) {
        return this.child('path', {d: d});
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
      svge: function () {
        return this.node.tagName == 'svg' ? this : new SVGElem(this.node.ownerSVGElement);
      },
      fit: function () {
        var box = this.node.getBBox();
        return this.svge().attrs({viewBox: [box.x, box.y, box.width, box.height]});
      },
      point: function (x, y) {
        var p = this.svge().node.createSVGPoint();
        p.x = x;
        p.y = y;
        return p;
      },
      transform: function (desc) {
        var xform = [];
        for (var k in desc)
          xform.push(k + '(' + [].concat(desc[k]).join(',') + ')');
        return this.attrs({transform: xform.join(' ')});
      }
    });

  Sky = {
    RGB: RGB,
    util: util,
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
