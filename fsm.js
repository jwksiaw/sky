(function () {
  var C = Sun.Cage.prototype;
  FSM = Sun.cls(function FSM(state, actions) {
    this.x = state;
    this.U = actions;
    this.T = {}
  }, {
    bind: function () {
      return this.do.bind.apply(this.do, [this].concat([].slice.call(arguments)))
    },
    act: function (x, u, args) {
      var ux = this.U[x]
      if (ux && u in ux)
        return ux[u].apply(this, args)
      return this.U.default[u].apply(this, args)
    },
    do: function (u, args) {
      var x = this.x;
      try {
        return this.transition(x, this.act(x, u, args) || x, u, args)
      } catch (e) {
        console.error(e, {fsm: this, state: x, input: u})
        throw (e)
      }
    },
    on: function (d, f) {
      var A = this.T;
      var B = A[d.input] = A[d.input] || {}
      var C = B[d.leave] = B[d.leave] || {}
      var D = C[d.enter] = C[d.enter] || []
      return D.push(f), this;
    },
    off: function (d, f) {
      var A = this.T;
      var B = A[d.input] || {}
      var C = B[d.leave] || {}
      var D = C[d.enter] || []
      return L.drop(D, f), this;
    },
    transition: function (l, e, u, args) {
      var A = this.T, self = this;
      if (A)
        [u, undefined].map(function (input) {
          var B = A[input]
          if (B)
            [l, undefined].map(function (leave) {
              var C = B[leave]
              if (C)
                [e, undefined].map(function (enter) {
                  (C[enter] || []).map(function (f) { f.call(self, l, e, u, args) })
                })
            })
        })
      return this.x = e;
    },
    once: C.once,
    til: C.til,
    race: function (any) {
      var self = this, n = 0, f = function () { return n++ }
      any.map(function (c) { self.til(c[0], c[1], f) })
      return this;
    }
  })
})();
