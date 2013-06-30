(function () {
  Sun = {
    groupby: function (list, key) {
      var k, key = key || function (item) { return item[0] };
      return list.reduce(function (acc, item) {
          var k_ = key(item);
          if (k_ == k)
            acc[acc.length - 1][1].push(item);
          else
            acc.push([k_, [item]]);
          k = k_;
          return acc;
        }, []);
    },
    int: function (x) {
      return parseInt(x, 10);
    },
    mod: function (x, y) {
      var r = x % y;
      return r < 0 ? r + y : r;
    },
    pad: function (s, opt) {
      var s = s + '', w = opt && opt.width || 2, p = opt && opt.pad || '0';
      while (s.length < w)
        s = p + s;
      return s;
    },
    repeat: function (fun, every) {
      return fun() || setTimeout(function () {
          fun() || setTimeout(arguments.callee, every);
        }, every);
    }
  };
})();
