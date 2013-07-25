(function () {
  var clip = function (x, m, M) { return Math.min(Math.max(x, m), M) };
  var Act = {
    dbltap: function (fun) {
      var dbl = 0;
      this.on('mouseup touchend', function (e) {
          if (dbl++)
            fun(e);
          setTimeout(function () { dbl = 0 }, 250);
        });
      return this;
    },
    swipe: function (fun, glob, stop) {
      var swipe, lx, ly;
      var doc = this.doc(), that = glob ? doc : this;
      this.on('mousedown touchstart', function (e) {
          swipe = true;
          lx = e.pageX;
          ly = e.pageY;
        });
      that.on('mousemove touchmove', function (e) {
          if (swipe) {
            fun(e.pageX - lx, e.pageY - ly, lx, ly, e.pageX, e.pageY);
            lx = e.pageX;
            ly = e.pageY;
            if (stop)
              e.stopImmediatePropagation();
            e.preventDefault();
          }
        });
      doc.on('mouseup touchend', function () {
          swipe = false;
        });
      return this;
    },

    hooke: function (restore, kx, ky) {
      return this.spring(function (dx, dy, mx, my) {
          if (mx > 1) dx /= kx || 32;
          if (my > 1) dy /= ky || 32;
          this.dx -= dx;
          this.dy -= dy;
          restore.call(this, dx, dy);
        });
    },
    spring: function (restore) {
      var self = this;
      var spring = function (dx, dy) {
        var equilibrium = !(spring.dx || spring.dy);
        spring.dx += dx;
        spring.dy += dy
        if (equilibrium)
          self.animate(function () {
              var dx = spring.dx, dy = spring.dy;
              return restore.call(spring, dx, dy, Math.abs(dx), Math.abs(dy)) || dx || dy;
            });
      };
      spring.dx = 0;
      spring.dy = 0;
      return spring;
    },

    dolly: function (x, y, w, h, bbox, fun) {
      var xmin = bbox ? bbox.x : x;
      var xmax = bbox ? bbox.x + bbox.width - w : x;
      var ymin = bbox ? bbox.y : y;
      var ymax = bbox ? bbox.y + bbox.height - h : y;
      var self = this;
      var dims = [x, y, w, h];
      this.attrs({viewBox: dims});
      return function (dx, dy) {
        dims[0] = clip(dims[0] - dx, xmin, xmax);
        dims[1] = clip(dims[1] - dy, ymin, ymax);
        fun && fun.apply(self, dims);
        return self.attrs({viewBox: dims});
      };
    },
    track: function (bbox, fun) {
      var cbox = this.node.getBBox();
      var offs = [bbox.x - cbox.x, bbox.y - cbox.y];
      var xmin = bbox ? offs[0] : x;
      var xmax = bbox ? offs[0] + bbox.width - cbox.width : x;
      var ymin = bbox ? offs[1] : y;
      var ymax = bbox ? offs[1] + bbox.height - cbox.height : y;
      var self = this;
      return function (dx, dy) {
        offs[0] = clip(offs[0] + dx, xmin, xmax);
        offs[1] = clip(offs[1] + dy, ymin, ymax);
        fun && fun.apply(self, offs);
        return self.transform({translate: offs});
      };
    }
  };

  Sky.Elem.prototype.update(Act);
})();