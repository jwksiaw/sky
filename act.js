(function () {
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
    dolly: function (x, y, w, h, bbox) {
      var xmin = bbox ? bbox.x : x;
      var xmax = bbox ? bbox.x + bbox.width - w : x;
      var ymin = bbox ? bbox.y : y;
      var ymax = bbox ? bbox.y + bbox.height - h : y;
      var self = this;
      var clip = function (x, m, M) { return Math.min(Math.max(x, m), M) };
      var dims = [x, y, w, h];
      this.attrs({viewBox: dims});
      return function (dx, dy) {
          return self.attrs({viewBox: [dims[0] = clip(dims[0] - dx, xmin, xmax),
                                       dims[1] = clip(dims[1] - dy, ymin, ymax), w, h]});
        };
    },
    spring: function (restore) {
      var self = this, spring = {
        potential: 0,
        stretch: function (dp) {
          var equilibrium = !(spring.potential);
          spring.potential += dp
          if (equilibrium)
            self.animate(function () { return restore.call(spring) || spring.potential });
        }
      };
      return spring;
    },
    swipe: function (fun, glob) {
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
            e.preventDefault();
          }
        });
      doc.on('mouseup touchend', function () {
          swipe = false;
        });
      return this;
    }
  };

  Sky.Elem.prototype.update(Act);
})();