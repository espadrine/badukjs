(function (root, factory) {
  if (typeof define === 'function' && define.amd) { // AMD.
    define(['exports'], factory);
  } else if (typeof exports === 'object' && typeof exports.nodeName !== 'string') { // CommonJS
    factory(exports);
  } else { // Browser globals
    root.Baduk = root.Baduk || {};
    factory(root.Baduk);
  }
}(this, function (exports) {

  // options:
  //   - size: typically 19.
  //   - komi: floating-point number.
  function Board(options) {
    options = options | {};
    this.size = +options.size || 19;
    this.komi = +options.komi || 7.5;
    this.board = new Uint8Array(this.size * this.size);
  }

  Board.prototype = {
    // x, y: integer positions of an intersection on the board.
    has: function(x, y) {
      return x >= 0 && x < this.size && y >= 0 && y < this.size;
    },
    get: function(x, y) {
      return this.board[x + y * this.size];
    },
    set: function(x, y, color) {
      return this.board[x + y * this.size] = color;
    },
    play: function(x, y, color) {
      var self = this;
      if (!self.has(x, y) || self.get(x, y) !== 0) {
        return false;
      }
      var possibleSuicide = true;
      var connected = [];
      [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].forEach(function (i, j) {
        if (!self.has(i, j)) {
          return;
        }
        switch(self.get(i, j)) {
          case 0:
            possibleSuicide = false;
            break;
          case color:
            connected.push(i, j);
            break;
          default:
            var captured = self.capture(i, j);
            if (captured > 0) {
              possibleSuicide = false;
            }
            break;
        }
      });
      if (possibleSuicide) {
        connected.forEach(function (i, j) {
          // TODO if (connected group has > 1 liberty) possibleSuicide = false
        });
        if (possibleSuicide) {
          return false;
        }
      }
      self.set(x, y, color);
      return true;
    },
    capture: function(x, y) {
      // TODO if (group has <= 1 liberty) remove group
      return 0;
    },
  };

  exports.Board = Board;

}));
