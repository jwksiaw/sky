(function () {
  var fmt = Sun.format, up = Sun.up, mod = Sun.mod;
  var log = Math.log, sqrt = Math.sqrt;
  var asin = Math.asin, PI = Math.PI;
  var haversin = function (d) { return sqr(sin(d / 2)) }
  var deg = function (r) { return 180 / PI * r }
  var rad = function (d) { return PI / 180 * d }
  var cos = function (d) { return Math.cos(rad(d)) }
  var sin = function (d) { return Math.sin(rad(d)) }
  var tan = function (d) { return Math.tan(rad(d)) }
  var sqr = function (x) { return x * x }

  function MTS(spec) {
    this.spec = spec;
    this.scheme = 'xyz';
  }
  up(MTS.prototype, {
    href: function (x, y, z) { return fmt(this.spec, {x: x, y: y, z: z}) },
    tile: function (x, y, z) { return y >= 0 ? this.href(mod(~~x, 1 << z), ~~y, z) : '' },
    project: function (l, z) {
      var z = z || 0, k = (1 << z) / 360;
      var p = Geo.mercator(l.lat, l.lng);
      var x = (p[0] + 180) * k, y = deg(PI - p[1]) * k;
      return [x, y, z];
    }
  });

  Geo = {
    haversine: function (lat, lng, lat_, lng_) {
      return asin(sqrt(haversin(lat_ - lat) + cos(lat) * cos(lat_) * haversin(lng_ - lng)));
    },
    mercator: function (lat, lng) { return [lng, log(tan(45 + lat / 2))] },
    mts: function (spec) { return new MTS(spec) },
    MTS: MTS
  }

  Sky.SVGElem.prototype.update({
    map: Orb.type(function Map(parent, jack, opts) {
      var opts = this.opts = up({center: {lat: 0, lng: 0}, zoom: 3, size: 256}, opts);
      var dims = this.dims = opts.dims || parent.bbox();

      var s = opts.size, mts = opts.mts;
      var c = dims.width / s, r = dims.height / s, C = Math.ceil(c) + 2, R = Math.ceil(r) + 2;
      var p = mts.project(opts.center, opts.zoom);
      var x = p[0], y = p[1], z = p[2];
      var box = Sky.box(x - C / 2, y - R / 2, C, R);

      var self = this;
      var elem = this.elem = parent.g().transform({scale: s, translate: [-(x - c / 2), -(y - r / 2)]})
      var jack = this.jack = box.grid(function (a, b, i, j) {
        var m = 0, n = 0;
        var tile = elem.g().transform({translate: [~~b.x, ~~b.y]});
        var img = tile.image(mts.tile(b.x, b.y, z)).xywh(0, 0, b.w, b.h);
        var loop = tile.loop(null, {
          bbox: box,
          wrap: function (wx, wy) {
            img.href(mts.tile(b.x + (m += wx * C), b.y + (n += wy * R), z));
          }
        });
        return a.push(tile.wagon(loop)), a;
      }, [], {rows: R, cols: C});

      this.move = function (dx, dy) {
        var sx = dx / s, sy = dy / s;
        x += sx;
        y += sy;
        Orb.move(jack, sx, sy);
      }

      this.goto = function (l) {
        var d = mts.project(l || opts.center, z);
        Orb.move(this, d[0] - x, d[1] - y);
      }

      this.add = function (f, l) {
        var t = mts.project(l || opts.center, z).slice(0, 2);
        var o = f.call(self, elem.g().transform({translate: t, scale: 1 / s}));
        if (o)
          jack.push(o);
        return o;
      }

      elem.scroll(this);
    })
  });
})();
