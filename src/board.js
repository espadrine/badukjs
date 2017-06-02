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
    get(x, y) { return this.board[x + y * this.size]; },
    set(x, y, color) { return this.board[x + y * this.size] = color; },
  };

  exports.Board = Board;

}));
